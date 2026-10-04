# AI Agent Guidelines — NexKan

Canonical project context for AI coding tools. Supported tools: **Claude Code**, **Google Antigravity (AGY)**, **Codex**. Each tool has its own thin entry point (`CLAUDE.md`, `.agents/`, `AGENTS.md` respectively) that points here for shared content and adds only what's genuinely tool-specific.

## Project Overview

NexKan is a self-hosted personal Kanban board. Tasks are markdown files with YAML frontmatter — no database. Telegram bot provides remote access. Designed for Raspberry Pi.

## Monorepo Structure

npm workspaces with three packages:

- `shared/` — `@nexkan/shared`: types, domain rules, date utils. Must be built before backend/frontend consume it.
- `backend/` — Fastify 5 + TypeScript REST API + grammy Telegram bot
- `frontend/` — React 18 + Vite + TanStack Query + dnd-kit

## Commands

### Root (run from repo root)

```bash
npm install          # install all workspaces
```

### Utility Scripts (run from repo root)

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
npm test             # vitest run
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
npm test             # vitest run
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
- `backend/src/storage/` — `StorageProvider` filesystem abstraction interface with `FileSystemStorageProvider` (production disk I/O) and `InMemoryStorageProvider` (in-memory test double).
- `backend/src/tasks/parser.ts` — serialize/deserialize between markdown files and `Task` objects via `gray-matter`.
- `backend/src/tasks/store.ts` — `TaskStore` with in-memory cache and file watcher. `sort_order` is an integer per column; reorder rewrites all affected files atomically with snapshot-based rollback.
- `backend/src/tasks/service.ts` — `TaskService` business logic and validation layer wrapping `TaskStore`.
- `backend/src/scratchpad/store.ts` — `NoteStore` CRUD operations.

### Backend

- `src/app.ts` — Fastify app, plugins mounted at `/api/tasks`, `/api/notes`, and `/api`
- `src/server.ts` — HTTP listener, starts Telegram webhook registration
- `src/tasks/router.ts` — Task REST endpoints, Zod validation on all inputs
- `src/scratchpad/router.ts` — Notes REST endpoints, Zod validation, and Task conversion logic
- `src/telegram/` — grammy bot, webhook handler at `POST /api/webhooks/telegram`, per-command files in `commands/`, `TelegramPresenter` for message formatting, notification cron endpoint at `POST /api/notifications/check`

### Frontend

- `src/lib/api.ts` — typed fetch wrapper, base URL from `VITE_API_URL` env or `/api`
- `src/hooks/useTasks.ts` — TanStack Query fetching with filter/sort params
- `src/hooks/useTaskMutation.ts` — mutations (create, update, status, order, delete) with cache invalidation
- `src/hooks/useNotes.ts` / `useNoteMutation.ts` — TanStack Query notes hooks
- `src/components/scratchpad/ScratchpadPanel.tsx` — sticky notes panel on Board and Dashboard pages
- `src/pages/BoardPage.tsx` — 3-column Kanban with dnd-kit drag-and-drop
- `src/pages/DashboardPage.tsx` — overdue, due today/tomorrow, stats
- `src/components/task/TaskDialog.tsx` — create/edit modal

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
- Telegram webhook middleware and startup check: if `TELEGRAM_BOT_TOKEN` is set, `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_CHAT_ID` must be configured (fail-closed, D2). Webhook requests require a valid `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET`; missing or mismatched secret returns 401.

## Shared AI Workflow Conventions

These conventions apply across all three supported tools (Claude Code, AGY, Codex). Tool-specific entry points may restate a short summary for discoverability, but this section is canonical.

### Graphify (Codebase Knowledge Graph)

This repo has a Graphify knowledge graph at `graphify-out/`.

- **Read first**: Before answering codebase, architecture, or relationship questions, check `graphify-out/GRAPH_REPORT.md` for community structure and god nodes.
- **Traversal**: For cross-module relationship questions, prefer `graphify query "<question>"` (BFS) or `graphify path "<nodeA>" "<nodeB>"` (shortest path) over raw grep.
- **Wiki navigation**: If `graphify-out/wiki/index.md` exists, navigate it first for broad orientation.
- **Keep current**: After modifying code files, run `graphify update .` to refresh the AST/graph (no API cost).

### RTK (Rust Token Killer) — Token-Optimized Commands

Token-optimized CLI proxy that cuts noisy command output before it reaches the model.

- **Golden rule**: prefix shell commands with `rtk` (e.g. `rtk git status`, `rtk npm test`). If RTK has a dedicated filter it's used; otherwise the command passes through unchanged.
- **Chained commands**: prefix each command in a chain individually (`rtk git add . && rtk git commit -m "msg" && rtk git push`).
- **Meta commands**: `rtk gain` (savings stats), `rtk gain --history` (usage history), `rtk discover` (find missed opportunities), `rtk proxy <cmd>` (bypass filtering for debugging).

### Caveman (Terse Communication)

Default communication style for this repo's AI sessions: terse, technical substance preserved, fluff removed.

- Drop articles, filler words, and pleasantries. Fragments are fine. Technical terms stay exact.
- Code, commits, and PRs are always written in normal prose — caveman style applies to conversational responses only.
- Drop caveman style for security warnings, irreversible-action confirmations, or when the user is confused; resume once that's resolved.
- Level selection: `/caveman lite|full|ultra`. Stop with "stop caveman" or "normal mode".

## Plans

- **Active plans**: When creating a plan file under `docs/plans/`, the filename must include the creation date using the format `YYYY-MM-dd-plan-name.md`.
  - Use the actual date when the plan is created.
  - Use a clear, descriptive name for `plan-name`.
  - Example: `2026-09-12-document-figures-alignment.md`
- **Completed plans**: When a plan is fully implemented, verified, and complete, move it into `docs/plans/completed/` (`docs/plans/completed/YYYY-MM-dd-plan-name.md`) to archive it and keep `docs/plans/` focused only on active work.
