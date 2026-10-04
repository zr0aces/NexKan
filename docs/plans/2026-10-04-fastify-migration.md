# Fastify + TypeScript Migration Plan — NexKan Backend

- **Created:** 2026-10-04
- **Status:** Completed. All phases (0–6) implemented, verified with contract, unit, and integration test suites (294 tests passing across workspaces), benchmarks recorded, merged to main, code-reviewed and hardened.
- **Baseline commit:** `c1dd95a` (main)
- **Baseline tests:** `cd backend && npx jest` gives 17 suites and 164 tests, all passing.

---

## 0. Summary and recommendation

The backend is small: about 2,000 lines in `backend/src`. It has three route modules: tasks, notes, and telegram. It keeps its data in Markdown files on disk. It has no database. It runs as one container behind nginx on a Raspberry Pi.

**Recommendation: replace the HTTP layer in place, on one branch, then cut over once.** Do not run Express and Fastify side by side in production. Reasons:

- Only the Express layer has to change. Four files depend on Express: `app.ts`, `tasks/router.ts`, `scratchpad/router.ts`, and `telegram/router.ts`. A fifth file, `telegram/middleware.ts`, uses only Express types. The services, stores, parsers, storage provider, and Telegram commands do not depend on the framework.
- Running two processes at once on the same data directory is not safe. Each process keeps its own in-memory cache, which a file watcher updates (`tasks/store.ts:29`, `:67`). The reorder writes are not atomic across files. The notifier has no lock between processes. Side-by-side running would cause lost updates and duplicate Telegram notifications.
- Rollback is cheap. The data format, file layout, env var names, and volume mounts stay the same, so rollback means pinning the previous image tag. Older images accept the configuration that D2 requires, so rolling back never needs a config change.

**Expected benefit, stated plainly.** Request cost is dominated by file I/O and the in-memory filter and sort, not by the router. Fastify should cut latency by a small amount. The real gains are built-in structured logging (pino), a defined request lifecycle, `app.close()` for graceful shutdown, and `inject()` for tests. Several of the confirmed bugs below matter more than the framework change. Fix them first.

---

## 1. Current architecture

### 1.1 Runtime and deployment

| Item | Current value | Evidence |
|---|---|---|
| Runtime | Node 24 (`node:24-slim`) and Node v24.15.0 locally | `backend/Dockerfile:2,27` |
| Language | TypeScript 5.9.3, `strict`, CommonJS, target ES2020 | `backend/tsconfig.json` |
| Framework | Express 4.22.2 | `backend/package.json` |
| Validation | zod 3.25.76, `safeParse` inside each handler | `tasks/router.ts:7-33`, `scratchpad/router.ts:7-13` |
| Telegram | grammy 1.43.0, webhook mode | `telegram/bot.ts`, `telegram/router.ts:24` |
| Storage | Markdown files with YAML frontmatter (gray-matter), plus an in-memory cache and `fs.watch` | `tasks/store.ts`, `storage/fileSystem.ts` |
| Process start | `sh -c "./scripts/init-data.sh && node dist/server.js"` | `backend/Dockerfile:50` |
| Edge | nginx handles basic auth, static frontend, and the `/api/` proxy. The backend port is only `expose`d. | `nginx/nexkan.conf`, `docker-compose.yml` |
| CI | Docker image build and push on release only. CI does not run tests. | `.github/workflows/release-docker.yml` |

### 1.2 Entry points and request flow

- `src/server.ts` sets up the Telegram bot when `TELEGRAM_BOT_TOKEN` is set. It calls `setWebhook` and `setMyCommands` on every boot, then `app.listen(port)`. It binds all interfaces, has no signal handling, and has no shutdown logic.
- `src/app.ts` builds the Express app with `express.json({ limit: '10kb' })` applied globally. It mounts:
  - `/api/tasks` to `createTaskRouter`
  - `/api/notes` to `createNoteRouter`
  - `/api` to `createTelegramRouter`

  It also creates the module-level default stores. Tests import that default `app`.
- `src/scripts/telegram-webhook.ts` is a standalone CLI that uses `fetch`. It does not depend on Express or Fastify.

### 1.3 Route inventory (the compatibility contract)

| # | Method and path | Edge auth (nginx) | App auth | Validation | Success | Errors |
|---|---|---|---|---|---|---|
| 1 | `GET /api/tasks` | Basic | — | none (query cast) | 200 `Task[]` | 500 `{error}` |
| 2 | `GET /api/tasks/:id` | Basic | — | — | 200 `Task` | 404 `{error:'Task not found'}`, 500 |
| 3 | `POST /api/tasks` | Basic | — | `CreateTaskSchema` | 201 `Task` | 400 `{error: flatten()}`, 400 `{error: msg}` (due_date), 500 |
| 4 | `PUT /api/tasks/:id` | Basic | — | `UpdateTaskSchema` | 200 `Task` | 400, 404 `{error: msg}`, 500 |
| 5 | `PATCH /api/tasks/:id/status` | Basic | — | `StatusSchema` | 200 `Task` | 400, 404, 500 |
| 6 | `PATCH /api/tasks/:id/order` | Basic | — | `OrderSchema` | 200 `Task` | 400, 404, 500 |
| 7 | `DELETE /api/tasks/:id` | Basic | — | — | 204 empty | 404, 500 |
| 8 | `GET /api/notes` | Basic | — | — | 200 `Note[]` | 500 |
| 9 | `POST /api/notes` | Basic | — | `ContentSchema` | 201 `Note` | 400, 500 |
| 10 | `PATCH /api/notes/:id` | Basic | — | `ContentSchema` | 200 `Note` | 400, 404, 500 |
| 11 | `DELETE /api/notes/:id` | Basic | — | — | 204 empty | 404, 500 |
| 12 | `POST /api/notes/:id/convert` | Basic | — | `ConvertSchema` | 201 `Task` | 400 (schema, first line, due_date), 404, 500 |
| 13 | `POST /api/webhooks/telegram` | **none** | `webhookAuth` (optional secret) | grammy | 200 (always, even on handler error) | 401 `{error:'Unauthorized'}` |
| 14 | `POST /api/notifications/check` | **none** | `cronAuth` (required secret) | — | 200 `{ok:true}` | 401, 500 `{error:'Notification check failed'}` |
| 15 | `GET /api/telegram/status` | Basic | — | — | 200 `{ok,bot}` | 503 `{ok:false,error}` |
| 16 | `POST /api/telegram/test` | Basic | — | — | 200 `{ok:true}` | 400, 500 |

Source files: `src/tasks/router.ts`, `src/scratchpad/router.ts`, `src/telegram/router.ts`. Errors in rows 3-7 and 12 are classified by matching substrings of the error message: `'due_date'`, `'not found'`, and `'first line'` (`tasks/router.ts:75,89,92`, `scratchpad/router.ts:69`). This mapping must be kept exactly.

### 1.4 Authentication, authorization, tenancy

- **Single-user application. It has no roles, no tenants, and no per-user data.** Every user in `.htpasswd` sees and changes the same board. Tenant isolation does not apply. The equivalent invariant is **"the backend is reachable only through nginx"** (`expose`, not `ports`).
- Browser and API auth is HTTP basic auth at nginx. The backend has no app-level auth, and the Fastify version will also have none.
- Two paths skip basic auth by design. Each relies on a header secret checked in the backend (`telegram/middleware.ts`):
  - `/api/webhooks/telegram` uses `X-Telegram-Bot-Api-Secret-Token`. This check is **optional**. It passes every request when `TELEGRAM_WEBHOOK_SECRET` is unset.
  - `/api/notifications/check` uses `X-Cron-Secret`. This check is **required**. It returns 401 when `CRON_SECRET` is unset.
- The Telegram bot guard (`telegram/utils.ts:6-14`, `telegram/router.ts:101`) checks `chat.id == TELEGRAM_CHAT_ID`. It **accepts every chat when the variable is unset**.

### 1.5 Data, jobs, integrations

- **Data:** `data/tasks/{id}-{slug}.md`, `data/scratchpad/{id}.md`, and `data/notifications-sent.json`. There is no DB schema and no migrations. The frontmatter and section format (`tasks/parser.ts`, `scratchpad/parser.ts`) is the "schema" and must not change.
- **Caching:** each store has a lazily loaded `Map` cache, kept in sync by a 50 ms debounced `fs.watch` callback.
- **Transactions:** a reorder writes N files with `Promise.all` and rolls back from snapshots if any write fails (`tasks/store.ts:287-327`). There is no cross-request locking.
- **Scheduled job:** an external cron calls `POST /api/notifications/check`. There is no in-process scheduler and no queue.
- **External integrations:** the Telegram Bot API, used for inbound webhook updates and outbound `sendMessage`, `setWebhook`, and `setMyCommands`.
- **Uploads:** none. The `attachments` field exists but nothing writes to it.

### 1.6 Logging, errors, tests

- Logging uses `console.*` only. There are no request logs and no correlation IDs.
- Errors are handled with try/catch in every handler. Express's default error handler covers body-parser failures and returns HTML.
- Tests: Jest 29 with ts-jest and supertest. They cover stores, services, routers, Telegram commands, middleware, and the notifier. Router tests import the module-level default `app` after setting `DATA_DIR` (`tests/tasks/router.test.ts:33-37`).

---

## 2. Review findings

Severity levels: Critical, High, Medium, Low. "Confirmed" means the issue was reproduced or is certain from the code. "Plausible" means the code path exists but the issue was not reproduced at runtime.

### 2.1 Confirmed

| ID | Severity | Finding | Evidence | Impact | Recommended action |
|---|---|---|---|---|---|
| F1 | **High** | A title rename can remove the task from the cache. `update()` writes the new file and deletes the old one (`tasks/store.ts:235-247`). The watcher callback for the old filename then sees "not exists" and calls `cache.delete(id)` (`:79-80`). That deletes the entry the store just updated. | Reproduced: a probe that renamed 20 tasks on a real filesystem lost 1 of them from the cache (the probe was deleted afterwards). | After a rename, the task disappears from the board and API until a restart or another file event. The data stays on disk. | In the watcher, delete only when `cache.get(id)?.filePath === filename`. Add a regression test that uses `FileSystemStorageProvider`. |
| F2 | **High** | The watcher ignores task IDs that contain `-`. `filename.split('-')[0]` is shorter than 8 characters when the nanoid contains `-` (`tasks/store.ts:71-72`). The nanoid alphabet includes `-`, so about 12% of IDs contain it. | Sample data: `6-U9UWe4-…`, `_I-QzPXF-…`, `qD4qw8D--…`, `shIFINU--…` (4 of 45 files). | External edits and deletes for those tasks never reach the cache. The files are meant to be human-readable (README), and the watcher exists so that edits made outside the app show up. For these IDs, it does not work. | Take `id = filename.slice(0, 8)` and require `filename[8] === '-'`. |
| F3 | **High** (configuration-dependent) | Telegram fails open. With `TELEGRAM_WEBHOOK_SECRET` unset, the public, unauthenticated webhook accepts any POST (`middleware.ts:10`). With `TELEGRAM_CHAT_ID` unset, the bot serves any chat (`utils.ts:8-10`). | Code. `.env.example` leaves both empty. Startup only logs a warning (`bot.ts:23-25`). | If both are unset, anyone who knows the URL can forge updates. They can create or move tasks and make the bot send task data to a chat they control. | **D2 (decided): refuse to start.** When `TELEGRAM_BOT_TOKEN` is set and either variable is missing, log an error and exit with code 1. Also make `webhookAuth` and `isAuthorizedChat` fail closed when their variable is unset. Ships in Phase 1. |
| F4 | Medium | Shutdown is not graceful, and writes are not atomic. `sh -c` is PID 1 and does not forward SIGTERM (`Dockerfile:50`), so Docker sends SIGKILL after 10 s. `writeFile` writes in place (`storage/fileSystem.ts:33`, `notifier.ts:24`). | Code. | A kill during a write can truncate a task file. That file is then skipped as "corrupted" on load (`tasks/store.ts:49-51`), so the user loses the task. | Use `exec node dist/server.js`. Handle SIGTERM and SIGINT by calling `app.close()`. Write to a temp file without the `.md` suffix, then `rename`. |
| F5 | Medium | Notifications can be sent twice. `checkAndNotify` reads, sends, then saves, with no lock (`notifier.ts:67-138`). Two overlapping cron calls both read the same `sent` state. | Code. | Duplicate Telegram messages if cron fires twice or retries while a run is still in progress. | Add an in-process single-flight guard: one module-level promise that concurrent callers share. Combine it with the atomic write from F4. |
| F6 | Low | Secret comparisons use `!==` and are not constant-time (`middleware.ts:12,28`). | Code. | Timing side channel. Exploiting it through nginx over the network is hard. | Use `crypto.timingSafeEqual` on equal-length buffers. |
| F7 | Low | A repeated query key (`?status=a&status=b`) arrives as an array. `.split` then throws, and the client gets a 500 (`tasks/router.ts:42-46`, `store.ts:112`). | Code. | A crafted URL returns 500. No data is affected. | Keep the 500 during the migration (parity). Optionally reject with 400 afterwards. |
| F8 | Low | Errors are classified by message substring (`tasks/router.ts:75-111`, `scratchpad/router.ts:69`). | Code. | Rewording an error message silently changes the status code. | Keep this as is during the migration. Introduce typed errors afterwards (optional). |
| F9 | Low | A new grammy `webhookCallback` is created on every request (`telegram/router.ts:26`). Error text goes into a Markdown message without escaping (`:33-36`, `:89-92`). | Code. | Small per-request overhead. The error report itself can fail to send because of a Markdown parse error. | Create the callback once at registration. Send error reports as plain text. |
| F10 | Low | No health endpoint, no Docker healthcheck, and no request logs. nginx waits only for `service_started`. | `docker-compose.yml` | Failures are silent, and deploys cannot be gated on health. | Add `GET /healthz` and a compose healthcheck (D5). |
| F11 | Low | Concurrent creates or status moves in the same column compute the same `max+1` `sort_order` (`tasks/store.ts:185-187`, `:266-269`). | Code. | Two tasks can share a `sort_order`. The next reorder fixes it. The app is single-user, so this is rare. | Do nothing now. Note it as a known limitation. |

### 2.2 Plausible / unverified

| ID | Severity | Risk | Why unverified | Verification step |
|---|---|---|---|---|
| U1 | Medium | The 10 KiB global body limit (`app.ts:12`) also applies to Telegram webhook updates. A 4,096-character message in a 3-byte UTF-8 script such as Thai is about 12 KiB before the JSON envelope, so Express returns 413. Telegram then retries and eventually drops the update. | Not replayed against a running server. | Phase 0 contract test: POST a 14 KiB update to the webhook and assert the status. |
| U2 | Low | CSRF. Browsers attach cached basic-auth credentials to cross-site requests. `POST /api/telegram/test` takes no body, so a hostile page can trigger it (it sends a spam message). The other mutating routes need a JSON object body, which a cross-site "simple" request cannot send. | Not tested in a browser. | Manual browser test. The Fastify version must **not** register a JSON parser for `text/plain`, `application/x-www-form-urlencoded`, or `*`. Removing the `text/plain` parser (C6) makes cross-site form and text POSTs return 415. A bodyless cross-site POST with no Content-Type still reaches `/api/telegram/test`, so U2 is only partly closed. A full fix (a custom header) is listed as optional in §8. |
| U3 | Low | When two first requests arrive at the same time, `ensureCacheLoaded` loads the cache twice (`tasks/store.ts:34-65`). The duplicate watcher is guarded in `FileSystemStorageProvider` but not in `InMemoryStorageProvider`. | The race window is small. | No action is needed for the migration. |

### 2.3 Not applicable (checked)

These were checked and do not apply:

- A database: there are no transactions, no migrations, and no connection pool.
- Queues and background workers.
- File uploads.
- Roles, RBAC, and multi-tenancy.
- CORS: the frontend is same-origin through nginx, and Express has no CORS today.
- Rate limiting: there is none today, and nginx is the boundary.

---

## 3. Target architecture

### 3.1 Versions and compatibility (verified 2026-10-04)

| Component | Choice | Verification |
|---|---|---|
| Fastify | `^5.12` (latest 5.12.5) | `npm view fastify version`. Fastify's CI test matrix runs Node **24 and 26** (`.github/workflows/ci.yml` on `main`). The LTS page lists 20 and 22. Node 24 is covered by upstream CI. |
| Node.js | Keep 24 (`node:24-slim`) | No change. |
| TypeScript | Keep 5.9, CommonJS, `strict` | Fastify 5 ships its own types and supports CommonJS `require`. `esModuleInterop` is already on. |
| zod | **Keep 3.25** in handlers | `fastify-type-provider-zod@7` requires `zod >=4.1.5` and `fastify ^5.5`. That would force a zod 4 upgrade and change the `flatten()` 400 bodies. Not needed. |
| grammy | Keep 1.43 | It has a built-in `'fastify'` adapter (`node_modules/grammy/out/convenience/frameworks.js:169`). The default timeout is 10 s with `onTimeout: 'throw'`, the same as today. |
| Test HTTP client | Keep supertest, pointed at `app.server` after `await app.ready()` | Keeps the test diff small. `app.inject()` is also available. |
| Logger | Fastify's built-in pino | Ships with Fastify. No new dependency. |

**Dependency changes:**

- Add `fastify`.
- Remove `express` and `@types/express`.
- **No `@fastify/*` plugins.** Reasons:
  - CORS is not used.
  - nginx sets the security headers, so helmet is not needed.
  - Body parsing is built in.
  - ETags are not needed. See C7.

### 3.2 Behaviour mapping: Express to Fastify

| Concern | Express today | Fastify target | Compatibility notes |
|---|---|---|---|
| Listen address | `app.listen(port)` binds all interfaces | `app.listen({ port, host: '0.0.0.0' })` | **Required.** Fastify defaults to `localhost`, which is unreachable from nginx in Docker. |
| JSON body parsing | `express.json({limit:'10kb'})`. Only `application/json` is parsed. An empty body gives `{}`. | Replace the `application/json` parser: an empty body gives `undefined`; anything else goes to `app.getDefaultJsonParser('error','error')`. Set root `bodyLimit: 10240`. | **Required.** The frontend sends `Content-Type: application/json` on **every** request, including bodyless `DELETE` (`frontend/src/lib/api.ts:6-13`). Fastify parses DELETE bodies when a content type is present and rejects an empty JSON body. Without this override, task and note deletes break. The default parser is kept so proto-poisoning protection stays. |
| Validation | zod `safeParse` in each handler gives 400 `{error: flatten()}` | Same code. No Fastify `schema.body`. | Keeps the 400 body byte for byte. Ajv would change it. |
| Response serialization | `res.json`, which is `JSON.stringify` | `reply.send(obj)`. **No response schemas.** | fast-json-stringify drops unknown properties and handles `undefined` differently. Without schemas, Fastify uses `JSON.stringify`. |
| Middleware order | `json` → router → `webhookAuth`/`cronAuth` → handler | `onRequest` (auth hooks) → parse → handler | Auth now runs **before** body parsing. A request with a bad secret and a malformed body now gets 401 instead of 400. This is an intended improvement (C5). |
| Route-level auth | Express middleware `(req,res,next)` | `onRequest: [webhookAuth]` hooks `(request, reply)` | Same 401 `{error:'Unauthorized'}`. |
| Error handler | Per-handler try/catch. Framework errors return Express HTML. | Keep the per-handler try/catch. `setErrorHandler` maps framework errors (`FST_ERR_CTP_*`, JSON syntax) to `{error: <message>}` with the original status code. | Status codes stay the same (400, 413). The body changes from HTML to JSON (C2). |
| 404 | Express HTML `Cannot GET /x` | `setNotFoundHandler` returns 404 `{error:'Not found'}` | Body changes (C3). nginx only proxies `/api/`. |
| Trailing slash | Non-strict: `/api/tasks/` matches | `ignoreTrailingSlash: true` | Parity. |
| Case sensitivity | Case-insensitive paths | Keep the Fastify default (case-sensitive) | `/API/TASKS` returns 404 (C4). Task IDs are case-sensitive nanoids. `caseSensitive:false` would lowercase matching, which is a risk. No client uses mixed-case paths. |
| Unsupported Content-Type | Body becomes `{}`, then zod 400 | `removeContentTypeParser('text/plain')`, so only `application/json` is parsed. Anything else returns 415 `FST_ERR_CTP_INVALID_MEDIA_TYPE`. | Status changes from 400 to 415 (C6). Without the removal, Fastify's built-in `text/plain` parser would pass a string to zod, which gives a different 400 body. |
| HEAD | Automatic for GET | `exposeHeadRoutes` (default true) | Parity. |
| ETag / X-Powered-By | Weak ETag on `res.json`, `X-Powered-By: Express` | Neither | C7. The frontend does not use conditional requests. |
| Query parsing | `qs` (nested and arrays) | Fastify default (flat; repeated keys become an array) | Every filter is a flat string. Repeated keys behave the same way (array, then 500, F7). |
| Async handlers | `void res.status().json()` | `return reply.code().send()` | Avoids double-send warnings. |
| Webhook | `webhookCallback(bot,'express')` per request | `webhookCallback(bot,'fastify')` created once per registration. The catch block uses `if (!reply.sent) reply.code(200).send()`. | Same 200-on-error semantics. Route `bodyLimit` follows D3. |
| Lifecycle / shutdown | None | SIGTERM/SIGINT → `app.close()` → `onClose` closes the stores' `fs.watch` handles. `return503OnClosing` (default) answers late requests. | New behaviour, and safe. |
| Logging | `console.*` | `logger: { level: process.env.LOG_LEVEL ?? 'info' }` with request logging on. The default serializers do not log headers, so the secrets in `X-Cron-Secret` and similar headers stay out of logs. | Domain modules keep `console.*`. Moving them to `app.log` is optional. |

### 3.3 Directory structure (minimal change)

Keep the feature folders. Change only the HTTP layer files. Add no new layers.

```
backend/src/
  app.ts                 # buildApp(taskStore, noteStore): FastifyInstance
                         #   - JSON parser override, bodyLimit, ignoreTrailingSlash
                         #   - setErrorHandler / setNotFoundHandler
                         #   - register(taskRoutes, {prefix:'/api/tasks'}) etc.
                         #   - GET /healthz (D5)
                         #   - onClose → stores.close()
                         #   - default instance export kept for tests
  server.ts              # listen 0.0.0.0, signal handlers, Telegram bootstrap
  tasks/router.ts        # export taskRoutes: FastifyPluginAsync<{taskStore}>
  scratchpad/router.ts   # export noteRoutes: FastifyPluginAsync<{noteStore, taskStore}>
  telegram/router.ts     # export telegramRoutes + setupBotCommands (unchanged)
  telegram/middleware.ts # webhookAuth/cronAuth as onRequest hooks
  (service, store, parser, storage, commands, presenter, notifier: no framework change)
```

Do not add these. Each is not needed now; add it only when the stated condition becomes true.

- A DI container: there are only two stores, passed as plugin options.
- A separate `plugins/` or `schemas/` directory: three plugins fit in their feature files.
- A config module: there are 8 env vars, read where they are used today.

---

## 4. Compatibility register

### 4.1 Preserved (must hold, enforced by tests)

The following stay the same:

- Every path, method, success status, and response body in §1.3.
- Every 400 `{error: flatten()}` body.
- The substring-based 400 and 404 mapping.
- The 204 empty body on deletes.
- The webhook's 200-on-error and timeout behaviour, and its 401 for a wrong secret.
- The cron 401 when the secret is missing or wrong.
- The Telegram chat guard when `TELEGRAM_CHAT_ID` is set.
- The file formats, filenames, `sort_order` semantics, and `notifications-sent.json` key format.
- Env var names and defaults. The exception is D2: `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_CHAT_ID` become required when `TELEGRAM_BOT_TOKEN` is set (C9). The startup check enforces those two. `TELEGRAM_WEBHOOK_URL` is documented as required, but nothing enforces it.
- Docker volumes, the port (3000), and nginx config. The nginx config needs no change.

### 4.2 Unavoidable or chosen differences (accepted under D4 on 2026-10-04)

| ID | Difference | Who is affected |
|---|---|---|
| C1 | DELETE with `Content-Type: application/json` and no body is accepted. This is parity, achieved by the custom parser. It is listed here because it must be implemented on purpose. | Frontend |
| C2 | Malformed JSON and oversize bodies return JSON `{error}` instead of Express HTML. The status (400 / 413) is the same. | None. The frontend already falls back to `HTTP <status>`. |
| C3 | An unknown route returns 404 JSON instead of HTML. | None |
| C4 | Path matching is case-sensitive. | None known |
| C5 | Webhook and cron auth run before body parsing (bad secret plus malformed body gives 401, not 400). | None |
| C6 | Any request that sends a Content-Type other than `application/json` (including `text/plain` and forms) returns 415 instead of 400. This includes requests with an **empty** body, because Fastify looks up a parser whenever the header is present. | Non-JSON scripted clients. The frontend is not affected (it always sends JSON). **The external cron is at risk:** `curl -X POST -d '' …` sends `application/x-www-form-urlencoded` and would get 415 instead of 200, so notifications would stop. A bare `curl -X POST` (no `-d`) is unaffected. Q1 must be answered, and the cutover check in §7.3 must pass, before Phase 6. If the cron does send a form content type, either change the cron command or register a no-op parser for `application/x-www-form-urlencoded` on `/api/notifications/check` only. |
| C7 | No `ETag` or `X-Powered-By` headers. There are no 304s. | None. Responses are slightly larger on repeat GETs. |
| C8 | A path parameter longer than 100 characters (Fastify `maxParamLength`) returns the router's 404 `{error:'Not found'}` instead of the handler's 404 `{error:'Task <id> not found'}`. The status is the same. | None. Real IDs are 8 characters. |
| C9 | Under D2, the webhook returns 401 when `TELEGRAM_WEBHOOK_SECRET` is unset (it used to return 200). A chat that does not match is rejected when `TELEGRAM_CHAT_ID` is unset (it used to be accepted). | Only deployments that are misconfigured. With a token set, those deployments no longer start at all. |

---

## 5. Migration phases

Phases 0 and 1 are each one PR, and both merge to `main`. **Phases 2, 3, and 4 are one PR** (`feat/fastify` → `main`), made of three commits, one per module. Phase 5 is one PR on the same branch. `main` stays on Express until Phase 6.

Why Phases 2 to 4 share one PR: the router tests cannot stay green module by module. `tests/tasks/router.test.ts` and `tests/scratchpad/router.test.ts` both import the shared `src/app`, and `tests/telegram/router.test.ts` and `tests/telegram/middleware.test.ts` build their own Express apps. The HTTP layer is about 400 lines, so one PR is reviewable.

- **Gate for each commit:** `tsc` passes, and the contract and unit tests for the modules migrated so far pass.
- **Gate for each PR:** the full `npx jest` suite and the contract suite pass.

### Phase 0 — Safety net and baselines (Express, no behaviour change)

- **Files:**
  - `backend/tests/contract/*.test.ts` (new): framework-neutral, uses supertest against an `http.Server`.
  - `backend/tests/contract/server.ts` (new helper): returns `http.createServer(app)` for Express, and `app.server` for Fastify later.
  - `docs/perf-baseline.md` (new, results only; not a plan, so it does not take the dated plan filename).
- **Content:**
  - One test per row of §1.3, covering success and every error branch. Assert the status, the `content-type`, and the exact JSON body.
  - Edge cases:
    - DELETE with a JSON content type and an empty body.
    - Malformed JSON.
    - A body larger than 10 KiB.
    - A 14 KiB webhook update (resolves U1).
    - A trailing slash.
    - A repeated query key.
    - `text/plain` and form POSTs to every mutating route (U2 guard).
    - Webhook with no secret, a wrong secret, and the correct secret.
    - Cron with the secret unset, wrong, and correct.
    - Cron with the correct secret and `Content-Type: application/x-www-form-urlencoded` with an empty body (the `curl -d ''` shape). It returns 200 on Express and 415 on Fastify (C6).
  - Mark the differences C2 to C8 with `it.each([...])` tables, with Express and Fastify expectations side by side, so the difference is explicit. C9 is not an Express-to-Fastify difference. It is a Phase 1 change on Express, and its cases flip in Phase 1.
- **Performance baseline:** never run it against production data or the production container.
  - The write benchmarks create thousands of tasks.
  - Port 3000 is not published.

  Run the production build directly on the Pi host (otherwise a dev box, and record which):

  ```
  DATA_DIR=$(mktemp -d) SCRATCHPAD_DIR=$(mktemp -d) NOTIFICATIONS_FILE=$(mktemp) \
    TELEGRAM_BOT_TOKEN= PORT=3999 node backend/dist/server.js
  ```

  Seed the 1,000 synthetic tasks with a throwaway script into that `DATA_DIR`. Use ad-hoc `npx autocannon` against `http://127.0.0.1:3999`, so it is not saved to `package.json`. Use 10 connections for 30 s. Run the Fastify comparison with the same commands and the same seed.
  - Measure p50, p95, p99, and req/s for:
    - `GET /api/tasks?sort=sort_order:asc`, with 45 tasks and with 1,000 synthetic tasks.
    - `POST /api/tasks`.
    - `PATCH /api/tasks/:id/order` in a 50-task column.
  - Also record RSS when idle, RSS after the load run, time from cold start to first 200, and image size.
- **Acceptance:**
  - The contract suite passes against Express.
  - The baseline numbers are recorded.
  - U1 is resolved (the status is recorded).

### Phase 1 — Fix confirmed defects and security issues before migrating (Express; D1, D2, D3)

These fixes are independent of the framework. Doing them first keeps the migration diff pure and lets the fixes ship to users before the migration. Ship it as its own release. D2 is a breaking change for deployments that are misconfigured.

- **Prerequisites:** Phase 0 merged.
- **Files:**
  - `src/tasks/store.ts`
    - F1: the watcher deletes a cache entry only when `cache.get(id)?.filePath === filename`.
    - F2: `id = filename.slice(0, 8)` and require `filename[8] === '-'`.
  - `src/storage/fileSystem.ts` (F4): `write()` writes to `.<filename>.<crypto.randomUUID()>.tmp` in the same directory, then calls `fs.promises.rename`. A random suffix is needed because two concurrent writes to the same task in one process would otherwise collide on the temp name. Before the rename, if the target exists, copy its mode with `chmod`, and its uid and gid with `chown`, onto the temp file. Ignore `EPERM`. This keeps files that the host user created editable by that user. The container runs as root because the Dockerfile has no `USER`, so a plain rename would make those files `root:root`. In-place writes today keep the original owner.
  - `src/telegram/notifier.ts` (F5): one module-level in-flight promise that concurrent callers share. Keep **in-place** `writeFile` for `notifications-sent.json`. See the risk below.
  - `src/telegram/middleware.ts` (F6, D2):
    - Compare secrets with `crypto.timingSafeEqual`. Check the lengths first.
    - `webhookAuth` returns 401 when `TELEGRAM_WEBHOOK_SECRET` is unset, the same way `cronAuth` does.
  - `src/telegram/utils.ts` (D2): `isAuthorizedChat` returns `false` when `TELEGRAM_CHAT_ID` is unset.
  - `src/server.ts` (D2): before `listen`, if `TELEGRAM_BOT_TOKEN` is non-empty and `TELEGRAM_WEBHOOK_SECRET` or `TELEGRAM_CHAT_ID` is empty or unset (the same truthiness test `server.ts:8` already uses), log `"Telegram misconfigured: TELEGRAM_BOT_TOKEN is set but <VAR> is missing. Set it or unset TELEGRAM_BOT_TOKEN."` and exit with code 1. `TELEGRAM_WEBHOOK_URL` stays optional, as it is today.
  - `src/app.ts` (D3): mount `webhookAuth` and then `express.json({ limit: '1mb' })` on `/api/webhooks/telegram` **before** the global 10 KiB parser. body-parser skips a body that is already parsed (`req._body`). Auth comes first, so an unauthenticated caller cannot make the server parse 1 MiB.
  - `backend/Dockerfile` (F4): `CMD ["sh", "-c", "./scripts/init-data.sh && exec node dist/server.js"]`.
  - `.env.example`, `docs/deployment.md`, `README.md`: mark `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_WEBHOOK_URL` as **required when `TELEGRAM_BOT_TOKEN` is set**. The startup check enforces only the first two; the URL is needed for re-registration.
  - `docs/api.md`: document C9. The webhook returns 401 when no secret is configured, and the 1 MiB webhook body limit (D3).
  - Release notes: a "Breaking" entry with these upgrade steps:
    1. Add `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_CHAT_ID` to `.env`. Also set `TELEGRAM_WEBHOOK_URL` if it is not set already.
    2. Restart the backend.
    3. Run `docker compose exec backend node dist/scripts/telegram-webhook.js set`.

    Why step 1 needs the URL:
    - On boot, `registerWebhook` registers the secret only when `TELEGRAM_WEBHOOK_URL` is set (`bot.ts:17-20`).
    - The `set` script exits with code 1 when the URL is unset (`telegram-webhook.ts:56-59`).
    - Without the URL, a webhook registered by hand without a secret would keep sending no header, and every update would get a 401.

    With the URL set, boot registration already sends the secret. Step 3 then confirms the registration and prints `info`.
  - Tests for each change. **Two existing tests assert the old fail-open behaviour and must be inverted on purpose, not deleted:**
    - `tests/telegram/middleware.test.ts:18` (secret unset, request passes).
    - `tests/telegram/utils.test.ts:15` ("returns true when TELEGRAM_CHAT_ID is not set").
  - The Phase 0 contract cases for these paths move from "current" to "D2" expectations in the same PR.
- **Risks:**
  - **`notifications-sent.json` is a single-file bind mount** (`docker-compose.yml`). `rename()` onto a bind-mounted file fails with `EBUSY`, so this file cannot use temp-plus-rename without changing the volume layout. Keep the in-place write. The worst case is a truncated file: `loadSent()` returns `{}` and that day's reminders are sent again once. No task data is lost. Moving the mount to a directory is optional and out of scope (it would change the deployment contract).
  - Temp files must not end in `.md`, so the watcher and the `list('.md')` loaders ignore them. A crash can leave a `.tmp` file behind. These files are harmless and ignored. Optionally remove files older than 1 hour at startup.
  - `rename` must stay on the same filesystem. The temp file is in the same directory (a directory bind mount), so it does.
  - Ownership: if `chown` fails (for example, on a rootless runtime), the file ends up owned by the container user. That is no worse than a new task file today.
  - With D2 and `restart: unless-stopped`, a misconfigured container restarts in a loop. nginx keeps `depends_on: service_started` (see Phase 5), so nginx still serves the frontend, and `/api` returns 502 until the variable is set. The error message names the missing variable.
- **Acceptance:**
  - The 20-iteration rename regression test passes on a real filesystem 10 runs in a row.
  - The watcher test passes for the ID `6-U9UWe4`.
  - Two concurrent `checkAndNotify` calls send each message once.
  - `docker stop` makes node exit on SIGTERM within 1 s. `docker inspect` shows exit code 143 (0 once Phase 5 handles the signal).
  - D2 tests:
    - The process exits with code 1 when the token is set and the secret is missing.
    - The process exits with code 1 when the token is set and the chat ID is missing.
    - The process starts with neither the token nor the secret set.
    - The webhook returns 401 with the secret unset.
    - A chat that does not match is rejected with the chat ID unset.
  - Upgrade check (manual, on the Pi), after the release-note steps:
    - `telegram-webhook.js info` shows no `last_error_message` after a test message.
    - `/tasks` in Telegram replies.
  - D3 test: a 14 KiB authorized webhook update is accepted (200). An 11 KiB `POST /api/tasks` still returns 413.

### Phase 2 — Fastify skeleton and notes module (PR A, commit 1 of 3)

- **Prerequisites:** Phases 0 and 1 merged to `main`. `feat/fastify` branches from `main` after that, so the contract suite already reflects D2 and D3.
- **Files:** `backend/package.json` (add `fastify`), `src/app.ts`, `src/scratchpad/router.ts`, `tests/scratchpad/router.test.ts`, `tests/contract/server.ts`.
- **Work:**
  - `buildApp()` with the JSON parser override, `removeContentTypeParser('text/plain')`, `bodyLimit`, `ignoreTrailingSlash`, the error and 404 handlers, and `onClose`.
  - Convert the five notes routes into a plugin.
  - The error handler maps any error without a `statusCode` to 500 `{error:'Internal server error'}`, so internal messages are never sent to clients. It maps `FST_ERR_*` and JSON syntax errors to `{error: message}` with their own status code.
  - Do not use `@fastify/express` as a bridge. The extra dependency is not worth it for three small routers. The branch is not deployable until Phase 4, and only the contract tests for modules already migrated must pass on Fastify.
- **Acceptance:**
  - The notes contract tests pass against Fastify.
  - DELETE with a JSON content type and an empty body returns 204.
  - A `text/plain` POST and an `application/x-www-form-urlencoded` POST to `/api/notes` both return 415.
  - `__proto__` in a JSON body returns 400.

### Phase 3 — Tasks module (PR A, commit 2 of 3)

- **Files:** `src/tasks/router.ts`, `tests/tasks/router.test.ts`.
- **Risks:**
  - Query typing: declare `Querystring` generics, and keep the current string casts to preserve F7 parity.
  - The 404, 400, and 500 classification order must stay identical.
- **Acceptance:** all task contract tests pass, including the filters and the trailing slash.

### Phase 4 — Telegram module and auth hooks (PR A, commit 3 of 3)

- **Files:**
  - `src/telegram/router.ts`
  - `src/telegram/middleware.ts`
  - `tests/telegram/router.test.ts`
  - `tests/telegram/middleware.test.ts`
- **Work:**
  - Use `webhookCallback(getBot(), 'fastify')`, resolved once per plugin registration. If the token is unset, keep the current lazy `getBot()` and its error path.
  - Set route `bodyLimit: 1048576` on the webhook (D3). Root stays 10240.
  - Turn `webhookAuth` and `cronAuth` (already fail-closed after Phase 1) into `onRequest` hooks. They run before parsing, so the larger limit only applies to authenticated callers.
  - The D2 startup check from Phase 1 stays in `server.ts` unchanged.
- **Acceptance:**
  - Webhook:
    - 401 when the secret is unset.
    - 401 for a wrong secret.
    - 200 for the correct secret.
    - 200 when the handler throws.
    - A 14 KiB update is accepted.
    - A 2 MiB update returns 413.
  - Cron: 401, 401, 200 for the secret unset, wrong, and correct.
  - Chat guard tests unchanged and green.

### Phase 5 — Server lifecycle, logging, health, removal of Express

- **Files:**
  - `src/server.ts`
  - `src/app.ts` (`/healthz`)
  - `backend/package.json` (remove `express` and `@types/express`)
  - `backend/Dockerfile` (`HEALTHCHECK` only. `exec` was added in Phase 1.)
  - `docker-compose.yml` and `docker-compose.prod.example.yml`: `stop_grace_period: 15s` only. Add **no** compose `healthcheck`, and keep nginx on `depends_on: service_started`. If nginx were gated on `service_healthy`, rolling back to an image without `/healthz` would stop nginx from starting, and a D2 misconfiguration would take down the whole UI.
  - `docs/api.md` (differences C2 to C8. C9 was documented in Phase 1.)
  - `docs/deployment.md` (the one-writer invariant, healthcheck, shutdown)
  - `scripts/smoke.sh` (new: the edge auth matrix in §6.2 and a create, move, delete round trip; takes the base URL and credentials as arguments)
- **Work:**
  - `listen({port, host:'0.0.0.0'})`.
  - `process.once('SIGTERM'|'SIGINT', () => app.close().then(() => process.exit(0)))`.
  - A 10 s forced-exit timer, unref'd.
  - Dockerfile `HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD` with this command: `node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`. The slim image has no curl.
- **Acceptance:**
  - `grep -r "from 'express'" backend/src` returns nothing.
  - The full Jest suite and the contract suite pass.
  - `docker compose up` reports the backend as healthy.
  - `docker stop` logs a clean shutdown and exits with code 0 in under 2 s.
  - The performance run is within the targets in §6.4.

### Phase 6 — Release and cutover

The procedure is in §7. Merge `feat/fastify`, tag a release, and the existing workflow builds the images.

### Dependency order

```
P0 ──► P1 ──► (release: fixes + D2/D3, Express)
         └──► [P2 ─ P3 ─ P4 : one PR] ──► P5 ──► P6
              (feat/fastify branches from main after P1 merges)
```

---

## 6. Test strategy

### 6.1 Compatibility (contract) tests

- The Phase 0 suite is the oracle. It runs against Express on `main` and against Fastify on the branch.
- Assertions cover the status, the `content-type`, the exact body (`toEqual`), and a `204` with an empty body.
- Snapshot the full `Task` and `Note` JSON shapes once. A field that is optional or `undefined` must stay absent from the JSON, not become `null`.

### 6.2 Authorization tests

There are no tenants, so "isolation" means that the trust boundaries hold.

- **App level (Jest):**
  - Webhook secret matrix.
  - Cron secret matrix.
  - Chat guard: allowed and wrong chat. When `TELEGRAM_CHAT_ID` is unset, the guard rejects (D2).
  - Startup refusal (D2): a child process with the token set and the secret or chat ID missing exits with code 1.
  - Callback-query guard.
- **Edge level (deploy smoke test, `scripts/smoke.sh`, curl). Expected results:**

| Request | Expected |
|---|---|
| `GET /api/tasks` without credentials | 401 |
| `GET /api/tasks` with credentials | 200 |
| `POST /api/notifications/check` without credentials, no secret | 401 from the backend |
| `POST /api/webhooks/telegram` without credentials, no secret header | 401 (always, after D2) |
| `GET /healthz` through nginx | not the health JSON (it is not proxied) |
| Port 3000 from the host | connection refused |

### 6.3 Integration tests

- Stores on a real filesystem in `os.tmpdir()`:
  - The rename race (F1).
  - Dash IDs (F2).
  - An external edit seen within 200 ms.
  - Atomic-write crash simulation: SIGKILL a child process in a write loop. On reload, expect no corrupted `.md` files. Leftover `.tmp` files are allowed and ignored.
- Notifier with a stubbed `bot.api.sendMessage`: concurrency and pruning.
- Webhook end to end: a sample `/add Buy milk tomorrow` update injected through `app.inject()` with the bot API stubbed. Assert that a file is created.

### 6.4 Performance targets (measured against the Phase 0 baseline)

| Metric | Target |
|---|---|
| p95 latency, each benchmarked route | ≤ baseline × 1.10 |
| req/s | ≥ baseline × 0.95 |
| Idle RSS | ≤ baseline + 10 MB |
| Cold start to first 200 | ≤ baseline + 500 ms |
| Image size | ≤ baseline + 5 MB |

Do not claim any improvement beyond the measured numbers.

---

## 7. Deployment, cutover, rollback

### 7.1 Health and shutdown

- **Health:** `GET /healthz` returns `200 {"status":"ok"}`. It is liveness only. It does not touch disk and does not call Telegram. It sits outside `/api`, so nginx does not expose it.
- **Docker:** the Dockerfile `HEALTHCHECK` interval is 10 s, timeout 3 s, retries 3, start period 10 s. There is no compose healthcheck, and nginx does not wait for health (Phase 5), so rollback to an older image stays safe.
- **Graceful shutdown order:**
  1. SIGTERM arrives.
  2. Fastify stops accepting new connections. `return503OnClosing` answers late requests.
  3. In-flight handlers finish.
  4. The `onClose` hook closes the watchers.
  5. The process exits with code 0.
- Atomic writes from Phase 1 mean a SIGKILL can no longer corrupt task or note files. `notifications-sent.json` can still be truncated (it is a single-file bind mount). If that happens, a day's reminders are sent again once.

### 7.2 Monitoring

- pino JSON logs go to stdout and are read with `docker compose logs`.
- Request logs include method, URL, status, and response time. Error logs include stack traces.
- After the cutover, watch these:

| Watch | Command or source | Expected |
|---|---|---|
| 4xx and 5xx counts | logs | normal levels |
| Webhook delivery | `telegram-webhook.js info` | `pending_update_count` = 0 and `last_error_message` = none |
| Container health | `docker inspect` | `healthy` |

- External uptime checks and metrics endpoints are **optional and out of scope**.

### 7.3 Cutover (single instance, no parallel run)

1. **Before the cutover:**
   - **Applies to the Phase 1 release and any later release.** If `TELEGRAM_BOT_TOKEN` is set in `.env`, confirm that `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_WEBHOOK_URL` are all set. If the secret or the chat ID is missing, the new backend exits on startup (D2). If the URL is missing, the webhook is never re-registered with the secret.
   - **For the Phase 6 release only:** run the exact production cron command (Q1) against the Phase 0 contract server on the branch. It must get 200. See C6.
   - Back up `data/`: `tar czf nexkan-data-$(date +%F).tgz data/`.
   - Record the current image tag (`NEXKAN_TAG`) as the rollback target.
   - Run `telegram-webhook.js info` and record the output.
2. Set `NEXKAN_TAG=<new>` and run `docker compose pull backend`.
3. Run `docker compose up -d backend`. Compose **stops the old container before it starts the new one** (same `container_name`), so two backends never write to `data/` at the same time.
   - Downtime is about the startup time.
   - Telegram queues webhook updates and retries them.
   - A cron run during that window gets a 502 from nginx and fires again on its next schedule.
   - `notifications-sent.json` is unchanged, so nothing is sent twice.
   - **For the Phase 1 release only:** next, run `docker compose exec backend node dist/scripts/telegram-webhook.js set`, so Telegram sends the secret header.
4. Run the smoke test (`scripts/smoke.sh`): the auth matrix, a create/move/delete round trip on a scratch task, and a Telegram `/tasks` round trip.
5. Run `telegram-webhook.js info`. Check that `pending_update_count` is 0 and that there is no new `last_error_message`.

### 7.4 Rollback

The data format is unchanged, so no data steps are needed.

1. Set `NEXKAN_TAG=<previous>` and run `docker compose up -d backend`.
2. Run `docker compose exec backend node dist/scripts/telegram-webhook.js set`. This re-registers the webhook to be safe. It is idempotent.
3. Re-run the smoke test.
4. Restore the `data/` backup only if files were corrupted, which atomic writes should prevent.

**Rollback triggers:**

- Any 5xx on routes that were green in the baseline.
- Webhook `last_error_message` set after the cutover.
- Health is not `healthy` within 60 s, or the container restarts in a loop. Check the logs for the D2 message first: the fix is to set the missing variable, not to roll back.
- p95 latency more than 1.5× the baseline in the first hour.

### 7.5 Guards against duplicate jobs, notifications, and writes

- **One writer:** never run two backend containers on the same `data/`. This is a documented invariant: compose `container_name` enforces one instance. Add the note to `docs/deployment.md`.
- **Notifications:** an in-process single-flight guard (F5) plus the persisted `sent` keys. These are written in place, because the file is a single-file bind mount; see the Phase 1 risk. The key format is unchanged, so the old and new versions share state correctly across the cutover.
- **Telegram updates:** Telegram redelivers when a response is not 2xx. The 200-on-error behaviour is kept. *Optional:* an in-memory set of recent `update_id`s (for example, the last 100) to drop redeliveries, which Telegram sends when a 200 is lost.
- **Webhook registration:** `setWebhook` at boot is idempotent.

---

## 8. Requirements and optional improvements

| Category | Items |
|---|---|
| **Required for the migration** | `host: '0.0.0.0'`; JSON parser override for empty bodies (C1); 10 KiB root `bodyLimit`; `ignoreTrailingSlash`; no response schemas; keep zod `safeParse` and the error mapping; grammy `'fastify'` adapter; auth hooks; contract suite; graceful `app.close()`; remove Express |
| **Required by decision (D1, D2, D3: Phase 1)** | F1, F2, F4, F5, F6; refuse to start on Telegram misconfiguration and fail-closed guards (F3); 1 MiB webhook body limit, applied after auth |
| **Required by decision (D5: Phase 5)** | `/healthz` and a Dockerfile `HEALTHCHECK`. No compose healthcheck. nginx stays on `service_started`. |
| **Optional, after the migration** | Typed domain errors in place of substring matching (F8); 400 for repeated query keys (F7); move domain `console.*` to `app.log`; Telegram `update_id` dedupe; CSRF hardening for `POST /api/telegram/test` (require a custom header); a CI workflow that runs `npm test` on each PR (none exists today) |

---

## 9. Assumptions, open questions, decisions

### Assumptions

- A1: Only one backend instance ever runs. The compose files and Pi target support this.
- A2: nginx is the only network path to the backend. Port 3000 is not published.
- A3: No client relies on Express-specific HTML error bodies, ETags, or case-insensitive paths. The only first-party client is `frontend/src/lib/api.ts`.
- A4: The external cron is idempotent and retries on its next schedule. Its configuration is not in the repo.

### Open questions

- Q1: Where does the external cron run, and how often? Does it retry on 5xx? What exact command does it run? This affects how much F5 matters, and whether C6 breaks it. **It must be answered before Phase 6.**
- Q2: Is the Raspberry Pi available for the Phase 0 benchmark? Dev-box numbers are not representative.
- Q3: Does any other script or integration call the API besides the frontend? This affects C2 to C9.

### Decisions (recorded 2026-10-04)

| ID | Decision | Outcome |
|---|---|---|
| D1 | Fix F1, F2, F4, F5, and F6 in Phase 1 before migrating. | **Approved.** |
| D2 | Telegram fail-open (F3). | **Approved: refuse to start.** If the token is set and the webhook secret or chat ID is missing, the process exits with code 1. The guards also fail closed. This is a breaking change for misconfigured deployments; see Phase 1 and §7.3. |
| D3 | Raise the webhook `bodyLimit` to 1 MiB. Other routes stay at 10 KiB. | **Approved.** It applies whatever Phase 0 shows for U1, because the limit only takes effect after auth. |
| D4 | Accept differences C2 to C9. | **Approved** (C8 and C9 were added in the post-decision review). |
| D5 | Add `GET /healthz` (outside `/api`) and a container healthcheck. | **Approved.** The review changed how it is delivered: a Dockerfile `HEALTHCHECK`, not a compose healthcheck, and nginx is not gated on health. This keeps rollback safe. |

---

## 10. Readiness assessment

- **Codebase readiness: high.** The HTTP layer is thin and well separated. The domain code does not depend on the framework. 164 passing tests already cover routers and middleware.
- **Risk: low to moderate.** The main traps are known and planned for:
  - the `localhost` default bind address
  - empty-body JSON on DELETE
  - accidental response serialization changes
  - running two instances on one data directory
- **Blockers:** none for now. D1 to D5 are decided. Phase 0 can start now. Q1 to Q3 are still open. None of them blocks Phases 0 to 5, but Q1 blocks Phase 6 (C6).
- **Value:** modest for performance. The real value is lifecycle, logging, and testability. The Phase 1 release (F1 to F6, D2, D3) gives the most immediate user-visible benefit. It is the only release with a breaking configuration change.

### First implementation milestone

**Phase 0: contract suite and performance baseline on Express.** It makes no production change. It produces the oracle that every later phase must pass, and it resolves U1. Done when the contract tests pass on `main` and `docs/perf-baseline.md` has the numbers recorded.
