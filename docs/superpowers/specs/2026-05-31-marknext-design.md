# MarkNext — Personal Kanban Board: Design Spec

**Date:** 2026-05-31
**Status:** Approved

---

## Overview

Lightweight, self-hosted personal Kanban board. Markdown files as primary storage. Web UI for task management. Telegram bot for notifications and remote task control. AI personal assistant layer (provider-agnostic, feature-flagged). Designed for low-resource servers (Raspberry Pi).

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Storage format | One markdown file per task |
| Task ID | nanoid(8) alphanumeric (e.g., `a3f9k2mw`) |
| Real-time sync | None — manual refresh only |
| Repo structure | Two root dirs: `frontend/` + `backend/` |
| Backend data layer | Stateless read-on-demand (no in-memory cache) |
| Notification trigger | OS cron daily → `POST /api/notifications/check` |
| Telegram code | Modular inside `backend/src/telegram/` — same container, clean boundaries |
| Due date | Date only (`YYYY-MM-DD`), no time component |
| AI integration | Provider-agnostic interface, stub by default, feature-flagged via `AI_ENABLED` |

---

## 1. Data Model

### Task File

- **Location:** `backend/data/tasks/`
- **Filename:** `{id}-{slug}.md` (e.g., `a3f9k2mw-buy-groceries.md`)
- **Slug:** title → lowercase, spaces to hyphens, special chars stripped, truncated to 40 chars
- **ID is authority** — slug is cosmetic and may drift from title

```markdown
---
id: a3f9k2mw
title: Buy groceries
status: todo
priority: high
tags: [shopping, personal]
due_date: 2026-06-01
sort_order: 3
created_at: 2026-05-15T10:30:00Z
updated_at: 2026-05-16T08:00:00Z
telegram_message_id: 98765
attachments:
  - receipts/jan2024.pdf
ai_summary: Quick errand, low cognitive load.
ai_tags: [errand, personal]
---

## Description

Buy milk, eggs, bread from the market.

## Notes

Check discount aisle for olive oil.
```

### Status Values

| Column | `status` value |
|--------|----------------|
| Plan | `plan` |
| Todo | `todo` |
| In Progress | `in-progress` |
| Done | `done` |

### Field Reference

**Required:** `id`, `title`, `status`, `created_at`, `updated_at`
**Required when status is `todo` or `in-progress`:** `due_date`
**Required:** `sort_order` (integer, controls card order within column)
**Optional:** `priority`, `tags`, `notes`, `attachments`, `telegram_message_id`
**Optional (AI):** `ai_summary`, `ai_tags`

### `due_date` Semantics

- Format: `YYYY-MM-DD` (date only, no time).
- Overdue: `due_date < today` (date comparison in server timezone).
- Due today: `due_date === today`.
- Due tomorrow: `due_date === today + 1 day`.
- Server timezone set via `TZ` env var (default: `UTC`).

### `sort_order` Semantics

- Integer. Lower = higher in column.
- Assigned on create: `max(sort_order in column) + 1`.
- Updated on drag-drop reorder via `PATCH /api/tasks/:id/order`.
- Reset to `max + 1` when task moves column (goes to bottom of target column).

### Deduplication State

`backend/data/notifications-sent.json` — tracks sent notifications.
Key format: `{taskId}:{trigger}:{reference-date}` where `reference-date` is the `due_date` value.

Examples:
- `a3f9k2mw:due-tomorrow:2026-06-01`
- `a3f9k2mw:due-today:2026-06-01`
- `a3f9k2mw:overdue:2026-06-03` (date notification was sent, not due date)

Cleared per task when status moves to `done`. Keys include `due_date` so rescheduling a task correctly re-triggers notifications.

**Pre-creation required:** `./data/notifications-sent.json` must exist before container starts. Init script: `echo '{}' > ./data/notifications-sent.json`.

---

## 2. Backend Architecture

### Folder Structure

Feature-based module structure. Each module owns its routes, services, and middleware.

```
backend/
  src/
    tasks/
      router.ts           ← task CRUD + reorder routes
      store.ts            ← all file I/O (readAll, readById, create, update, delete, reorder)
      parser.ts           ← Task ↔ markdown serialization via gray-matter
    telegram/
      router.ts           ← webhook + notifications/check + status + test routes
      bot.ts              ← grammy setup, webhook registration on startup
      commands/
        add.ts
        tasks.ts
        today.ts
        overdue.ts
        move.ts
        task.ts
        help.ts
        ai.ts             ← /ai command stub (AI_ENABLED gate)
        brief.ts          ← /brief command stub (AI_ENABLED gate)
      callbacks.ts        ← inline button handler (move:, view:)
      notifier.ts         ← due date check + Telegram sends
      middleware.ts       ← webhook-auth + cron-auth
    ai/
      interface.ts        ← AIProvider interface
      tools.ts            ← AI tool definitions mapping to tasks/store.ts
      context.ts          ← system prompt builder (task state → AI context)
      session.ts          ← in-memory chat history keyed by Telegram chat ID
      router.ts           ← /api/ai/* endpoints
      providers/
        stub.ts           ← default no-op provider (always returns "AI not enabled")
        anthropic.ts      ← Claude with tool use (wire when AI_PROVIDER=anthropic)
    types/
      task.ts             ← shared Task interface
    app.ts                ← mounts tasks/, telegram/, ai/ routers
    server.ts
  data/
    tasks/                ← markdown files (Docker volume)
    notifications-sent.json
  scripts/
    init-data.sh          ← creates ./data dirs and pre-creates notifications-sent.json
  .env.example
  Dockerfile
  package.json
  tsconfig.json
```

### Libraries

| Purpose | Library |
|---------|---------|
| Frontmatter parse/serialize | `gray-matter` |
| Telegram bot | `grammy` |
| Natural language dates | `chrono-node` |
| ID generation | `nanoid` |
| Date handling | `date-fns` |
| Schema validation | `zod` |
| HTTP server | `express` |

### API Endpoints

```
# Tasks
GET    /api/tasks                  ?status=&tags=&priority=&sort=&search=
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
PATCH  /api/tasks/:id/status       ← validates due_date requirement on status change
PATCH  /api/tasks/:id/order        ← updates sort_order within column
DELETE /api/tasks/:id

# Telegram
POST   /api/webhooks/telegram      ← Telegram delivers updates here (no nginx auth)
POST   /api/notifications/check    ← OS cron hits this (no nginx auth, X-Cron-Secret)
GET    /api/telegram/status
POST   /api/telegram/test

# AI (return 501 when AI_ENABLED=false)
POST   /api/ai/chat                ← natural language assistant with full task CRUD via tools
POST   /api/ai/brief               ← AI daily summary (stateless, no session)
GET    /api/ai/status              ← AI provider connection status
```

### `?sort=` Options

| Value | Description |
|-------|-------------|
| `due_date:asc` (default) | Earliest due date first |
| `due_date:desc` | Latest due date first |
| `priority:desc` | High priority first |
| `created_at:desc` | Newest first |
| `sort_order:asc` | Manual drag-drop order (default within board view) |

### `?search=` Scope

Search is limited to frontmatter fields: `title`, `tags`. Body content is not searched in v1 (would require reading every file — unacceptable on Raspberry Pi SD card at scale). Document this limitation in API docs.

### tasks/store.ts Responsibilities

Pure file I/O service. No caching.

- `readAll(filters?)` — scan `data/tasks/`, parse each `.md`, apply filters, sort by `sort_order`
- `readById(id)` — scan directory for `{id}-*.md`, parse (O(n) — acceptable at personal scale)
- `create(data)` — generate nanoid, assign `sort_order = max + 1`, write file
- `update(id, data)` — find file, update frontmatter + body, write
- `updateStatus(id, status)` — validates `due_date` present if status ∈ `{todo, in-progress}`, updates `status` + `updated_at` + resets `sort_order` to bottom of target column
- `updateOrder(id, newOrder)` — shifts other tasks' `sort_order` in same column to make room
- `delete(id)` — find file by ID prefix, unlink

### Notification Logic (telegram/notifier.ts)

Called on every `POST /api/notifications/check`. Compares dates only (no time).

1. Read all tasks where `status !== done`
2. Get `today = new Date()` in server timezone (`TZ` env)
3. For each task with `due_date`:
   - `due_date === tomorrow` → send "Due tomorrow" alert (key `{taskId}:due-tomorrow:{due_date}`)
   - `due_date === today` → send "Due today" alert (key `{taskId}:due-today:{due_date}`)
   - `due_date < today` → send "Overdue" alert (key `{taskId}:overdue:{today-date}`)
4. Update `data/notifications-sent.json`

Keys include `due_date` so rescheduling always re-triggers correctly. Overdue key uses `today-date` (not `due_date`) so it re-notifies each day the task remains overdue.

### Telegram Webhook Error Handling

All command handlers must catch errors and reply with a user-facing message, then return 200 OK. Uncaught errors cause Telegram to retry the webhook indefinitely.

```
try {
  // handle command
} catch (err) {
  await ctx.reply('Something went wrong. Try again.');
  // log error
}
// always return 200
```

### Module Boundaries

- `telegram/` imports from `tasks/store.ts` directly (same process). No HTTP between modules.
- `ai/` calls `tasks/store.ts` directly via tool handlers in `ai/tools.ts`.
- `tasks/` has zero knowledge of `telegram/` or `ai/`.

---

## 2b. AI Personal Assistant

AI is feature-flagged. When `AI_ENABLED=false` (default), all `/api/ai/*` endpoints return `501` and Telegram AI commands reply "AI not enabled." No stub calls slow the system — gate checked at request entry.

The AI is a **full personal assistant** with read + write access to tasks. It understands natural language, reasons about the task board, and executes actions (create, edit, move, delete) autonomously via tool use.

### Agentic Loop

```
User message
  → ai/router.ts
    → context.ts builds system prompt (today's date, overdue count, task summary)
    → provider.chat(message, history, tools)
      → AI reasons, decides which tools to call
      → tool executor calls tasks/store.ts
      → results returned to AI
      → AI may call more tools (multi-step reasoning)
    → AI returns final text response
  → reply to user
```

Example: `"move all overdue tasks to done"`
1. AI calls `list_tasks({overdue: true})`
2. AI calls `move_task("a3f9", "done")`, `move_task("b2x9", "done")`, ...
3. AI replies: "Moved 3 overdue tasks to Done: Buy groceries, Deploy backend, Write report."

### AIProvider Interface (ai/interface.ts)

```typescript
interface AIProvider {
  chat(
    message: string,
    history: ChatMessage[],
    tools: AIToolDefinition[],
    systemPrompt: string
  ): Promise<AIResponse>;
  isAvailable(): boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  toolCalls?: AIToolCall[];   // AI wants to execute tools
  message?: string;           // final text response (no more tool calls)
}

interface AIToolCall {
  name: string;
  input: Record<string, unknown>;
}
```

### AI Tools (ai/tools.ts)

Tools the AI can call. Each maps to a `tasks/store.ts` function.

```typescript
const AI_TOOLS: AIToolDefinition[] = [
  {
    name: 'list_tasks',
    description: 'List tasks with optional filters. Use to read the board state.',
    input: {
      status?: 'plan' | 'todo' | 'in-progress' | 'done' | string,  // comma-separated
      tags?: string,        // comma-separated
      priority?: string,
      overdue?: boolean,    // due_date < today
      due_today?: boolean,
      due_tomorrow?: boolean,
      search?: string,      // title/tags only
    }
  },
  {
    name: 'get_task',
    description: 'Get full details of a single task by ID.',
    input: { id: string }
  },
  {
    name: 'create_task',
    description: 'Create a new task.',
    input: {
      title: string,            // required
      description?: string,
      due_date?: string,        // YYYY-MM-DD
      priority?: 'low' | 'medium' | 'high',
      tags?: string[],
      status?: 'plan' | 'todo' | 'in-progress',  // default: plan
    }
  },
  {
    name: 'update_task',
    description: 'Edit task fields. Only provided fields are updated.',
    input: {
      id: string,               // required
      title?: string,
      description?: string,
      notes?: string,
      due_date?: string,        // YYYY-MM-DD
      priority?: 'low' | 'medium' | 'high',
      tags?: string[],
    }
  },
  {
    name: 'move_task',
    description: 'Change task status (move between Kanban columns).',
    input: {
      id: string,
      status: 'plan' | 'todo' | 'in-progress' | 'done',
      due_date?: string,        // required if moving to todo/in-progress and task has none
    }
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. Use only when user explicitly asks.',
    input: { id: string }
  },
]
```

### Context Builder (ai/context.ts)

Builds system prompt from current board state. Injected on every chat call.

```
You are a personal task assistant. Today is {YYYY-MM-DD} ({TZ}).
Board state: {total} tasks — {overdue} overdue, {due_today} due today, {done_today} completed today.
Active tasks: {plan_count} in Plan, {todo_count} in Todo, {inprogress_count} In Progress.
You can read and modify tasks using the provided tools.
When deleting, confirm intent if not explicit. When moving to todo/in-progress, ensure due_date is set.
```

### Chat History (ai/session.ts)

In-memory session store. Keyed by source identifier:
- Web: session cookie or request header `X-Session-ID`
- Telegram: Telegram chat ID

```typescript
// Max 20 messages per session (sliding window)
// Cleared on server restart (acceptable for personal use — no persistence needed)
const sessions = new Map<string, ChatMessage[]>();
```

### API Endpoint

```
POST /api/ai/chat
Body: { message: string, sessionId?: string }
Response: {
  reply: string,
  actions: AIAction[]   // audit log of what AI did
}

interface AIAction {
  tool: string;                                          // e.g. "move_task"
  description: string;                                   // e.g. "Moved 'Buy groceries' → done"
  taskId?: string;
}
```

### Providers

| Provider | File | Notes |
|----------|------|-------|
| Stub | `providers/stub.ts` | Returns "AI not enabled." No API calls. |
| Anthropic Claude | `providers/anthropic.ts` | Tool use via Anthropic SDK. Model: claude-sonnet-4-6 by default. |

Provider resolved at startup via `AI_PROVIDER` env var. Falls back to stub if init fails.

### Telegram AI Commands

| Command | Action |
|---------|--------|
| `/ai <prompt>` | Sends prompt to `/api/ai/chat`. Session keyed by Telegram chat ID. AI can read and modify tasks. Multi-turn: each `/ai` message continues the same session. |
| `/brief` | Calls `list_tasks` for all active tasks → AI generates daily summary with priorities and suggestions. No session — stateless call. |

### Optional Task Fields Written by AI

Stored in frontmatter after AI edits:

- `ai_summary` — AI-written one-line summary (set after `update_task` or `create_task`)
- `ai_tags` — tags AI added (merged into `tags` directly — no separate acceptance step)

---

---

## 3. Frontend Architecture

### Folder Structure

```
frontend/
  src/
    pages/
      BoardPage.tsx       ← Kanban board (main view)
      DashboardPage.tsx   ← stats + upcoming + overdue summary
    components/
      board/
        KanbanBoard.tsx
        KanbanColumn.tsx
        TaskCard.tsx
      task/
        TaskDialog.tsx    ← create/edit modal (ShadCN Dialog)
        TaskDetail.tsx    ← read-only detail view
      dashboard/
        StatsCard.tsx
        DeadlineList.tsx
        OverdueList.tsx
      shared/
        FilterBar.tsx     ← search + filter + sort controls
        PriorityBadge.tsx
        TagBadge.tsx
    hooks/
      useTasks.ts         ← TanStack Query wrappers
      useTaskMutation.ts
    lib/
      api.ts              ← fetch wrappers for REST endpoints
      utils.ts
    types/
      task.ts             ← mirrors backend Task interface
    App.tsx
    main.tsx
  index.html
  vite.config.ts
  tailwind.config.ts
  package.json
  tsconfig.json
```

Note: No runtime frontend container. Vite builds to `frontend/dist/` during deploy; nginx serves static files directly.

### Libraries

| Purpose | Library |
|---------|---------|
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Server state | `@tanstack/react-query` |
| Routing | `react-router-dom` v6 |
| UI components | `shadcn/ui` |
| Icons | `lucide-react` |
| Date display | `date-fns` |

### Routes

```
/           → BoardPage
/dashboard  → DashboardPage
```

### Data Flow

```
api.ts (fetch) → TanStack Query cache → page components → board/task components
```

No global state manager. TanStack Query handles all server state. `useTasks()` fetches with filters; `useTaskMutation()` wraps create/update/delete/reorder and invalidates cache on success.

### Drag-and-Drop

`DndContext` wraps `KanbanBoard`. Two drag events:

- **Cross-column drop:** triggers `PATCH /api/tasks/:id/status`
- **Same-column reorder:** triggers `PATCH /api/tasks/:id/order`

Optimistic update: move card immediately, revert on API error. Cards within each column sorted by `sort_order` ascending.

### Overdue Highlighting

`TaskCard` computes overdue client-side: `due_date < today (date only) && status !== done` → red border + "Overdue" badge. Date comparison uses `date-fns/isAfter` against start of today.

### Responsive

Tailwind breakpoints. Mobile: single-column scroll. Tablet: 2-column. Desktop: 4-column Kanban.

---

## 4. Telegram Integration

### Bot Commands

| Command | Action |
|---------|--------|
| `/add <title> [date]` | Create task in `plan` column. `date` accepts ISO (`2026-06-01`) or natural language (`tomorrow`, `next monday`) via `chrono-node`. Parsed to `YYYY-MM-DD`. |
| `/tasks` | List all non-done tasks grouped by status |
| `/today` | Tasks where `due_date === today` |
| `/overdue` | Tasks where `due_date < today`, status ≠ done |
| `/task <id>` | Task detail + inline action buttons |
| `/move <id> <status>` | Move task (`plan\|todo\|in-progress\|done`). If target status requires `due_date` and task has none, bot replies asking for date. Status input normalized to lowercase. |
| `/help` | Command reference |
| `/ai <prompt>` | Natural language task management (stub — requires `AI_ENABLED=true`) |
| `/brief` | AI daily summary (stub — requires `AI_ENABLED=true`) |

### Inline Keyboard Buttons

`/task <id>` response includes buttons:

```
[ Start Task ]  [ Complete ]
[ Move → Todo ] [ Move → Done ]
```

`callback_data` format: `move:{taskId}:{newStatus}`
grammy callback handler parses and calls `tasks/store.updateStatus()` directly.

### Notification Message Format

```
⚠️ Overdue: Buy groceries (a3f9k2mw)
Due: yesterday · Status: todo
[ View Task ]

🔔 Due today: Deploy backend (b2x9m1qp)
Status: in-progress
[ View Task ]

📅 Due tomorrow: Write report (c7z2p4nq)
Status: todo
[ View Task ]
```

`[ View Task ]` is a callback button with `callback_data: "view:{taskId}"`. Bot handler responds with full task detail + action buttons.

### Webhook Security

Telegram sends `X-Telegram-Bot-Api-Secret-Token` header with every request.
`telegram/middleware.ts` `webhookAuth` validates against `TELEGRAM_WEBHOOK_SECRET` env var. Returns 401 on mismatch.

All handlers wrap in try/catch — always return 200 OK to Telegram (prevents retry storms).

Webhook registered at backend startup via grammy's `setWebhook`.

---

## 5. Infrastructure

### Docker Compose Services

```
nginx       ← HTTPS termination, auth, reverse proxy (port 80/443)
backend     ← Express API: tasks + telegram + ai modules (port 3000, internal)
```

Frontend is static — Vite builds to `frontend/dist/`, nginx serves directly (no runtime container).

```yaml
# docker-compose.yml (outline)
services:
  backend:
    build: ./backend
    volumes:
      - ./data/tasks:/app/data/tasks
      - ./data/notifications-sent.json:/app/data/notifications-sent.json
    env_file: .env
    expose: ["3000"]

  nginx:
    build: ./nginx
    ports: ["80:80", "443:443"]
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx/certs:/etc/nginx/certs
      - ./nginx/.htpasswd:/etc/nginx/.htpasswd
    depends_on: [backend]
```

### Nginx Routing

```nginx
# Telegram webhook — no auth, secret-token validated by backend middleware
location /api/webhooks/telegram {
    auth_basic off;
    proxy_pass http://backend:3000;
}

# Cron notification trigger — no auth, X-Cron-Secret validated by backend middleware
location /api/notifications/check {
    auth_basic off;
    proxy_pass http://backend:3000;
}

# All other API — requires auth
location /api/ {
    auth_basic "MarkNext";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://backend:3000;
}

# Frontend static files
location / {
    auth_basic "MarkNext";
    auth_basic_user_file /etc/nginx/.htpasswd;
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

### OS Cron (Notification Trigger)

Runs once daily (morning). Cron environment does not expand `.env` variables — secret must be written to a dedicated file.

```bash
# Setup (run once):
echo "$CRON_SECRET" > /etc/marknext/cron-secret
chmod 600 /etc/marknext/cron-secret
```

```cron
# /etc/cron.d/marknext
0 8 * * * root curl -s -X POST https://yourdomain.com/api/notifications/check \
  -H "X-Cron-Secret: $(cat /etc/marknext/cron-secret)"
```

Backend `telegram/middleware.ts` `cronAuth` validates `X-Cron-Secret` header.

### Environment Variables

```bash
# .env.example

# Server
PORT=3000
NODE_ENV=production
TZ=UTC                                   # server timezone for date comparisons

# Data
DATA_DIR=/app/data/tasks
NOTIFICATIONS_FILE=/app/data/notifications-sent.json

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram
CRON_SECRET=

# AI (optional — system runs fully without these)
AI_ENABLED=false
AI_PROVIDER=stub                         # stub | anthropic
ANTHROPIC_API_KEY=                       # required when AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-6               # Anthropic model ID
AI_MAX_TOKENS=1024                       # max tokens per AI response
AI_SESSION_MAX_MESSAGES=20               # sliding window per chat session
```

### Data Persistence

```
./data/                          ← git-ignored, bind-mounted into backend container
  tasks/                         ← markdown task files
  notifications-sent.json        ← notification dedup state (must pre-exist as file)
```

Init script (`scripts/init-data.sh`):
```bash
#!/bin/bash
mkdir -p ./data/tasks
[ -f ./data/notifications-sent.json ] || echo '{}' > ./data/notifications-sent.json
```

Backup strategy: `git init ./data` + commit, or rsync/Syncthing on `./data/`.

---

## 6. Security

- HTTPS only (nginx terminates TLS)
- Telegram webhook validated via `X-Telegram-Bot-Api-Secret-Token` header
- Notification cron endpoint validated via `X-Cron-Secret` header (secret stored in file, not env — safe from cron expansion issues)
- Auth handled by nginx (basic auth, OAuth2 proxy, or OIDC — no internal user system)
- All secrets via environment variables — no hardcoded credentials
- `.env` git-ignored
- AI API keys isolated in env — never logged, never sent to client

---

## Deliverables

- `frontend/` — React + TypeScript + Vite + ShadCN + dnd-kit
- `backend/` — Node.js + Express + TypeScript (tasks + telegram + ai modules)
- `backend/src/tasks/store.ts` — markdown file I/O engine
- `backend/src/telegram/` — grammy bot, commands, notifier (modular)
- `backend/src/ai/` — provider interface, tool definitions, agentic loop, session store, Anthropic implementation
- `backend/scripts/init-data.sh` — data directory initializer
- `docker-compose.yml` + `backend/Dockerfile`
- `nginx/` — nginx config with auth + webhook routing
- `.env.example`
- `docs/` — deployment guide + API reference
