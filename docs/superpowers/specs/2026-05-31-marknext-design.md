# MarkNext — Personal Kanban Board: Design Spec

**Date:** 2026-05-31  
**Status:** Approved

---

## Overview

Lightweight, self-hosted personal Kanban board. Markdown files as primary storage. Web UI for task management. Telegram bot for notifications and remote task control. Designed for low-resource servers (Raspberry Pi).

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Storage format | One markdown file per task |
| Task ID | nanoid(8) alphanumeric (e.g., `a3f9k2mw`) |
| Real-time sync | None — manual refresh only |
| Repo structure | Two root dirs: `frontend/` + `backend/` |
| Backend data layer | Stateless read-on-demand (no in-memory cache) |
| Notification trigger | OS cron → `POST /api/notifications/check` |
| Telegram isolation | Dedicated `telegram` container; calls `backend` API internally |

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
due_date: 2024-01-20
created_at: 2024-01-15T10:30:00Z
updated_at: 2024-01-16T08:00:00Z
telegram_message_id: 98765
attachments:
  - receipts/jan2024.pdf
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

### Required vs Optional Fields

**Required:** `id`, `title`, `status`, `created_at`, `updated_at`  
**Required when status is `todo` or `in-progress`:** `due_date`  
**Optional:** `priority`, `tags`, `notes`, `attachments`, `telegram_message_id`

### Deduplication State

`telegram/data/notifications-sent.json` — tracks sent notifications, keyed by `taskId:trigger`.  
Cleared per task when status moves to `done` (telegram container detects via `/api/tasks` poll or on move command).

---

## 2. Backend Architecture

### Folder Structure

```
backend/
  src/
    routes/
      tasks.ts            ← CRUD endpoints only
    services/
      task-store.ts       ← all file I/O (readAll, readById, create, update, delete)
      task-parser.ts      ← Task ↔ markdown serialization via gray-matter
    types/
      task.ts             ← Task interface
    app.ts
    server.ts
  data/
    tasks/                ← markdown files (Docker volume shared with telegram)
  .env.example
  Dockerfile
  package.json
  tsconfig.json
```

### Libraries

| Purpose | Library |
|---------|---------|
| Frontmatter parse/serialize | `gray-matter` |
| ID generation | `nanoid` |
| Date handling | `date-fns` |
| Schema validation | `zod` |
| HTTP server | `express` |

### API Endpoints

```
GET    /api/tasks                  ?status=&tags=&priority=&search=&sort=
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
PATCH  /api/tasks/:id/status
DELETE /api/tasks/:id
```

Task CRUD only. Telegram and notification endpoints live in the `telegram` container.

### task-store.ts Responsibilities

Pure file I/O service. No caching.

- `readAll(filters?)` — scan `data/tasks/`, parse each `.md`, apply filters
- `readById(id)` — find file by ID prefix in filename, parse
- `create(data)` — generate nanoid, build filename, write file
- `update(id, data)` — find file, update frontmatter + body, write
- `updateStatus(id, status)` — partial update, only changes `status` + `updated_at`
- `delete(id)` — find file by ID, unlink

### Notification Logic

Moved to `telegram` container. See Section 2b.

---

## 2b. Telegram Container

Dedicated container for all Telegram concerns. Calls `backend` REST API internally for task operations — no direct file access.

### Folder Structure

```
telegram/
  src/
    routes/
      webhook.ts          ← POST /webhooks/telegram
      notifications.ts    ← POST /notifications/check (cron target)
      status.ts           ← GET /status, POST /test
    bot/
      commands/
        add.ts
        tasks.ts
        today.ts
        overdue.ts
        move.ts
        task.ts
        help.ts
      callbacks.ts        ← inline button handler (move:, view:)
    services/
      telegram-bot.ts     ← grammy setup, webhook registration on startup
      notifier.ts         ← due date check + Telegram sends
      backend-client.ts   ← HTTP client calling backend:3000/api
    middleware/
      webhook-auth.ts     ← validate X-Telegram-Bot-Api-Secret-Token
      cron-auth.ts        ← validate X-Cron-Secret
    types/
      task.ts             ← mirrors backend Task type
    app.ts
    server.ts
  data/
    notifications-sent.json  ← dedup state (Docker volume)
  Dockerfile
  package.json
  tsconfig.json
```

### Libraries

| Purpose | Library |
|---------|---------|
| Telegram bot | `grammy` |
| Natural language dates | `chrono-node` |
| Date handling | `date-fns` |
| Schema validation | `zod` |
| HTTP server | `express` |

### Endpoints

```
POST   /webhooks/telegram       ← Telegram delivers updates (secret-token validated)
POST   /notifications/check     ← OS cron target (X-Cron-Secret validated)
GET    /status                  ← Telegram bot connection status
POST   /test                    ← Send test Telegram message
```

### backend-client.ts

All task reads/writes go through the backend REST API over Docker internal network (`http://backend:3000`). No direct file I/O. No auth between containers (internal network only).

```
telegram container → http://backend:3000/api/tasks → task-store.ts → ./data/tasks/
```

### Notification Logic (notifier.ts)

Called on every `POST /notifications/check`:

1. `GET http://backend:3000/api/tasks?status=plan,todo,in-progress` — fetch active tasks
2. For each task with `due_date`:
   - If within now+24h ±30min → send alert (key `{taskId}:due-24h`)
   - If within now+1h ±10min → send alert (key `{taskId}:due-1h`)
   - If `due_date` < now → send overdue alert (key `{taskId}:overdue:{YYYY-MM-DD}`)
3. Update `data/notifications-sent.json`

Dedup key examples: `a3f9k2mw:due-24h`, `a3f9k2mw:overdue:2026-05-31`.

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
  Dockerfile
  package.json
  tsconfig.json
```

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

No global state manager. TanStack Query handles all server state. `useTasks()` fetches with filters; `useTaskMutation()` wraps create/update/delete and invalidates cache on success.

### Drag-and-Drop

`DndContext` wraps `KanbanBoard`. Dropping a card on a different column triggers `PATCH /api/tasks/:id/status`. Optimistic update: move card immediately, revert on API error.

### Overdue Highlighting

`TaskCard` computes overdue client-side: `due_date < Date.now() && status !== done` → red border + "Overdue" badge.

### Responsive

Tailwind breakpoints. Mobile: single-column scroll. Tablet: 2-column. Desktop: 4-column Kanban.

---

## 4. Telegram Integration

### Bot Commands

| Command | Action |
|---------|--------|
| `/add <title> [date]` | Create task in `plan` column. `date` accepts ISO (`2026-06-01`) or natural language (`tomorrow`, `next monday`) via `chrono-node` |
| `/tasks` | List all non-done tasks grouped by status |
| `/today` | Tasks with `due_date` = today |
| `/overdue` | Tasks where `due_date` < today, status ≠ done |
| `/task <id>` | Task detail + inline action buttons |
| `/move <id> <status>` | Move task (`plan\|todo\|in-progress\|done`) |
| `/help` | Command reference |

### Inline Keyboard Buttons

`/task <id>` response includes buttons:

```
[ Start Task ]  [ Complete ]
[ Move → Todo ] [ Move → Done ]
```

`callback_data` format: `move:{taskId}:{newStatus}`  
grammy callback handler parses and calls `task-store.updateStatus()` directly.

### Notification Message Format

```
⚠️ Overdue: Buy groceries (a3f9k2mw)
Due: 2 days ago · Status: todo
[ View Task ]

🔔 Due in 1 hour: Deploy backend (b2x9m1qp)
Due: 14:00 today · Status: in-progress
[ View Task ]
```

`[ View Task ]` is a callback button with `callback_data: "view:{taskId}"`. Bot handler responds with the full task detail message + action buttons (same as `/task <id>` output).

### Webhook Security

Telegram sends `X-Telegram-Bot-Api-Secret-Token` header with every request.  
`webhook-auth.ts` validates against `TELEGRAM_WEBHOOK_SECRET` env var. Returns 401 on mismatch.

Webhook registered at backend startup via grammy's `setWebhook`.

---

## 5. Infrastructure

### Docker Compose Services

```
nginx       ← HTTPS termination, auth, reverse proxy (port 80/443)
backend     ← Task CRUD REST API (port 3000, internal)
telegram    ← Telegram webhook + bot + notifications (port 4000, internal)
```

Frontend is static — Vite builds to `frontend/dist/`, nginx serves directly (no runtime container).

```yaml
# docker-compose.yml (outline)
services:
  backend:
    build: ./backend
    volumes:
      - ./data/tasks:/app/data/tasks
    env_file: .env
    expose: ["3000"]

  telegram:
    build: ./telegram
    volumes:
      - ./data/notifications-sent.json:/app/data/notifications-sent.json
    env_file: .env
    expose: ["4000"]
    depends_on: [backend]

  nginx:
    build: ./nginx
    ports: ["80:80", "443:443"]
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx/certs:/etc/nginx/certs
      - ./nginx/.htpasswd:/etc/nginx/.htpasswd
    depends_on: [backend, telegram]
```

### Nginx Routing

```nginx
# Telegram webhook — no auth, secret-token validated by telegram container
location /webhooks/telegram {
    auth_basic off;
    proxy_pass http://telegram:4000;
}

# Cron notification trigger — no auth, X-Cron-Secret validated by telegram container
location /notifications/check {
    auth_basic off;
    proxy_pass http://telegram:4000;
}

# Telegram status/test — requires auth
location /telegram/ {
    auth_basic "MarkNext";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://telegram:4000;
}

# Task API — requires auth
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

```cron
# /etc/cron.d/marknext
0 * * * * root curl -s -X POST https://yourdomain.com/notifications/check \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

`telegram` container validates `X-Cron-Secret` header via `cron-auth.ts` middleware.

### Environment Variables

```bash
# .env.example

# backend
DATA_DIR=/app/data/tasks
PORT=3000
NODE_ENV=production

# telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhooks/telegram
CRON_SECRET=
BACKEND_URL=http://backend:3000
TELEGRAM_PORT=4000
```

### Data Persistence

```
./data/                          ← git-ignored
  tasks/                         ← markdown task files (mounted into backend)
  notifications-sent.json        ← notification dedup state (mounted into telegram)
```

Backup strategy: `git init ./data` + commit, or rsync/Syncthing on `./data/`.

---

## 6. Security

- HTTPS only (nginx terminates TLS)
- Telegram webhook validated via secret token header
- Notification cron endpoint validated via `X-Cron-Secret` header
- Auth handled by nginx (basic auth, OAuth2 proxy, or OIDC — no internal user system)
- All secrets via environment variables — no hardcoded credentials
- `.env` git-ignored

---

## Deliverables

- `frontend/` — React + TypeScript + Vite + ShadCN + dnd-kit
- `backend/` — Node.js + Express + TypeScript (task CRUD only)
- `backend/src/services/task-store.ts` — markdown file I/O engine
- `telegram/` — Node.js + Express + grammy (webhook + bot + notifications)
- `docker-compose.yml` + `Dockerfile` × 2 (backend, telegram; frontend static)
- `nginx/` — nginx config with auth + webhook routing
- `.env.example`
- `docs/` — deployment guide + API reference
