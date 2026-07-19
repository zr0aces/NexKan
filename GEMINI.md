# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NexKan is a self-hosted personal Kanban board. Tasks are markdown files with YAML frontmatter — no database. Telegram bot provides remote access. Designed for Raspberry Pi.

## Monorepo Structure

npm workspaces with three packages:

- `shared/` — `@nexkan/shared`: types, domain rules, date utils. Must be built before backend/frontend consume it.
- `backend/` — Express 4 + TypeScript REST API + grammy Telegram bot
- `frontend/` — React 18 + Vite + TanStack Query + dnd-kit

## Commands

### Root (run from `/home/san/workspace/NexKan`)

```bash
npm install          # install all workspaces
```

### Utility Scripts (run from `/home/san/workspace/NexKan`)

```bash
./scripts/add-user.sh <username>          # Add or update basic-auth user
./scripts/remove-user.sh <username>       # Remove basic-auth user
./scripts/telegram-webhook.sh <cmd>       # Manage Telegram webhook (info, set, delete, set-commands)
# Or inside Docker (production):
docker compose exec backend node dist/scripts/telegram-webhook.js <info|set|delete|set-commands>
node scripts/sync-version.mjs [version]   # Sync version to all workspaces
node scripts/release.mjs [version]        # Auto-sync, build, and output git release commands
```

### Shared

```bash
cd shared
npm run build        # compile to dist/ — required before backend/frontend use it
npm run build:watch  # watch mode during development
```

### Backend

```bash
cd backend
npm run dev          # ts-node-dev with hot reload
npm run build        # tsc → dist/
npm run start        # run compiled dist/server.js
npm test             # jest
npx jest path/to/test.ts   # single test file
```

### Frontend

```bash
cd frontend
npm run dev          # vite dev server
npm run build        # tsc -b && vite build → dist/
npm run preview      # preview production build
```

### Docker (production)

```bash
docker compose up -d        # start backend + nginx
docker compose down         # stop
docker compose build        # rebuild backend image
```

Frontend is served as static files via nginx from `frontend/dist/`. Run `npm run build` in `frontend/` before deploying.

## Architecture

### Storage Layer

- **Tasks**: Tasks live in `data/tasks/` as markdown files named `{id}-{slug}.md`. Each file has YAML frontmatter (id, title, status, priority, tags, due_date, sort_order, timestamps) plus `## Description` and optional `## Notes` sections in the body.
- **Scratchpad Notes**: Notes live in `data/scratchpad/` as markdown files named `{id}.md`.
- `backend/src/tasks/parser.ts` — serialize/deserialize between markdown files and `Task` objects via `gray-matter`.
- `backend/src/tasks/store.ts` — all task file I/O: CRUD, filter, sort, reorder. Every operation reads from disk (no in-memory cache). `sort_order` is an integer per column; reorder rewrites all affected files atomically with snapshot-based rollback.
- `backend/src/scratchpad/store.ts` — note file CRUD operations.

### Backend

- `src/app.ts` — Express app, routes mounted at `/api/tasks`, `/api/notes`, and `/api`
- `src/server.ts` — HTTP listener, starts Telegram webhook registration
- `src/tasks/router.ts` — Task REST endpoints, Zod validation on all inputs
- `src/scratchpad/router.ts` — Notes REST endpoints, Zod validation, and Task conversion logic
- `src/telegram/` — grammy bot, webhook handler at `POST /api/webhooks/telegram`, per-command files in `commands/`, notification cron endpoint at `POST /api/notifications/check`

### Frontend

- `src/lib/api.ts` — typed fetch wrapper, base URL from `VITE_API_URL` env or `/api`
- `src/hooks/useTasks.ts` — TanStack Query fetching with filter/sort params
- `src/hooks/useTaskMutation.ts` — mutations (create, update, status, order, delete) with cache invalidation
- `src/hooks/useNotes.ts` / `useNoteMutation.ts` — TanStack Query notes hooks
- `src/components/scratchpad/ScratchpadPanel.tsx` — sticky notes panel on Board and Dashboard pages
- `src/pages/BoardPage.tsx` — 3-column Kanban with dnd-kit drag-and-drop
- `src/pages/DashboardPage.tsx` — overdue, due today/tomorrow, stats
- `src/components/task/TaskDialog.tsx` — create/edit modal
- `src/types/task.ts` — frontend re-exports (keep in sync with `@nexkan/shared`)

### Shared Package (`@nexkan/shared`)

Single source of truth for types and domain logic used by both backend and frontend:

- `src/types/task.ts` — `Task`, `CreateTaskInput`, `UpdateTaskInput`, `TaskFilters`
- `src/types/note.ts` — `Note` (scratchpad sticky notes)
- `src/lib/task.ts` — `TASK_STATUSES`, `requiresDueDate()`, `isOverdue()`
- `src/lib/date.ts` — `parseLocalDate()` (parses YYYY-MM-DD without timezone shift)

**`due_date` rule:** `todo` and `in-progress` statuses require a `due_date`. `done` does not. This is enforced in `store.ts` and `TaskDialog.tsx` via `requiresDueDate()` from shared.

### Telegram Bot

Webhook mode (not polling). Token, chat ID, webhook URL, and secrets are all env vars. `chrono-node` parses natural-language dates in `/add`. The `TELEGRAM_CHAT_ID` guard in `middleware.ts` restricts all commands to a single authorized user/group.

### Environment

Copy `.env.example` to `.env`. Key vars:

| Var | Purpose |
|-----|---------|
| `TZ` | IANA timezone — must match browser for correct overdue/due-today classification |
| `DATA_DIR` | Path to task markdown files |
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram user/group ID |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS URL for webhook delivery |
| `CRON_SECRET` | Auth header for `POST /api/notifications/check` |
| `SCRATCHPAD_DIR` | Path to scratchpad note files (default: `data/scratchpad/`) |

## Key Invariants

- Task filename format: `{8-char-nanoid}-{slug}.md`. `readById` and `findFilePath` rely on prefix matching `{id}-`.
- `sort_order` is column-scoped. Two tasks in different columns can share the same value; only within-column ordering matters.
- `due_date` stored as `YYYY-MM-DD` string, never a Date object, in both files and API payloads.
- `@nexkan/shared` must be built (`shared/dist/`) before backend or frontend TypeScript compilation succeeds.
- Note filename format: `{8-char-nanoid}.md` (no slug, no section headings). Store controlled by `SCRATCHPAD_DIR` env var.
- `shared/dist/` is gitignored — never `git add shared/dist/`. Only commit `shared/src/` changes after building.
- Telegram webhook middleware and `registerWebhook()` are symmetric: if `TELEGRAM_WEBHOOK_SECRET` unset → register without secret + middleware passes all; if set → validate header. Mismatch causes 401. Fix: `docker compose exec backend node dist/scripts/telegram-webhook.js set`.

## 🛠️ UNIFIED AI WORKFLOW (Graphify, RTK, Caveman, Claude-Mem)

This repository adopts a unified AI development workflow across **Claude Code**, **Google Antigravity CLI (`agy`)**, and **Codex**. Follow these instructions strictly:

### 1. Graphify (Codebase Knowledge Graph)
This project has a Graphify knowledge graph at `graphify-out/`.
- **Read first**: Before answering codebase, architecture, or relationship questions, check `graphify-out/GRAPH_REPORT.md` for community structures and god nodes.
- **BFS Traversal**: For cross-module relationship questions, use `graphify query "<question>"` (BFS) or `graphify path "<nodeA>" "<nodeB>"` (shortest path) rather than grepping.
- **Wiki Navigation**: If `graphify-out/wiki/index.md` exists, navigate it first.
- **Keep Current**: After modifying code files, run `graphify update .` to update the AST/graph without API costs.

### 2. RTK (Rust Token Killer) - Token-Optimized Commands
- **Golden Rule**: Always prefix commands with `rtk`. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged.
- **Chained Commands**: Prefix each command in a chain (e.g., `rtk git add . && rtk git commit -m "msg" && rtk git push`).
- **Commands by Workflow**:
  - *Git*: `rtk git status` (compact status), `rtk git diff` (compact diff), `rtk git log` (compact log).
  - *Build/Compile*: `rtk cargo build`, `rtk tsc` (grouped typescript errors), `rtk lint` (grouped eslint violations).
  - *Test*: `rtk cargo test` / `rtk jest` / `rtk vitest` / `rtk playwright test` (failures only).
  - *JavaScript*: `rtk npm run <script>`, `rtk npx <cmd>`, `rtk pnpm install` (compact install output).
  - *Search/Files*: `rtk ls` (tree format), `rtk read <file>` (filtered reading), `rtk grep <pattern>` (grouped search).
  - *Meta*: `rtk gain` (savings stats), `rtk gain --history` (history), `rtk proxy <cmd>` (bypass filter).

### 3. Caveman (Terse Communication)
- **Always Active**: Respond terse like a smart caveman. All technical substance stays, only fluff/pleasantries die.
- **Rules**:
  - Drop articles (a/an/the), filler (basically, just, really), pleasantries ("Sure! I'd be happy to help"), and hedging.
  - Fragments are OK. Short synonyms. Technical terms exact. Code/commits/PRs written normally.
  - Pattern: `[thing] [action] [reason]. [next step].`
    * *Example*: "Bug in auth middleware. Fix: [code]. Verify."
- **Auto-Clarity**: Drop caveman mode for security warnings, irreversible actions, or when the user is confused. Resume after.
- **Level Selection**: `/caveman lite|full|ultra|wenyan` (default is full). Use "stop caveman" or "normal mode" to stop.

### 4. Claude-Mem (Cross-Session Memory)
This project uses `claude-mem` for persistent memory across sessions.
- **Context Injection**: Review the `<claude-mem-context>` block injected at session start for active observations.
- **Memory Queries**: When asked about previous sessions/fixes, use the `search` and `timeline` MCP tools to query memory.
- **3-Layer Workflow**:
  1. **Search**: Run `search(query="...", project="...")` to retrieve a compact list of IDs.
  2. **Timeline**: Run `timeline(anchor=ID, project="...")` to inspect context around specific events.
  3. **Fetch**: Use `get_observations(ids=[...])` to retrieve detailed observations only for target IDs.
