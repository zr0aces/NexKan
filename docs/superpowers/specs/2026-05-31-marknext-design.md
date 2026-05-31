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
| Telegram code | Modular inside `backend/src/telegram/` — same container, clean boundaries |

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

`backend/data/notifications-sent.json` — tracks sent notifications, keyed by `taskId:trigger`.  
Cleared per task when status moves to `done`.

---

## 2. Backend Architecture

### Folder Structure

Feature-based module structure. Each module owns its routes, services, and middleware.

```
backend/
  src/
    tasks/
      router.ts           ← task CRUD routes
      store.ts            ← all file I/O (readAll, readById, create, update, delete)
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
      callbacks.ts        ← inline button handler (move:, view:)
      notifier.ts         ← due date check + Telegram sends
      middleware.ts       ← webhook-auth + cron-auth
    types/
      task.ts             ← shared Task interface
    app.ts                ← mounts tasks/ and telegram/ routers
    server.ts
  data/
    tasks/                ← markdown files (Docker volume)
    notifications-sent.json
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
GET    /api/tasks                  ?status=&tags=&priority=&search=&sort=
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
PATCH  /api/tasks/:id/status
DELETE /api/tasks/:id

POST   /api/webhooks/telegram      ← Telegram delivers updates here
POST   /api/notifications/check    ← OS cron hits this
GET    /api/telegram/status
POST   /api/telegram/test
```

### tasks/store.ts Responsibilities

Pure file I/O service. No caching.

- `readAll(filters?)` — scan `data/tasks/`, parse each `.md`, apply filters
- `readById(id)` — find file by ID prefix in filename, parse
- `create(data)` — generate nanoid, build filename, write file
- `update(id, data)` — find file, update frontmatter + body, write
- `updateStatus(id, status)` — partial update, only changes `status` + `updated_at`
- `delete(id)` — find file by ID, unlink

### Notification Logic (telegram/notifier.ts)

Called on every `POST /api/notifications/check`:

1. Read all tasks where `status !== done` via `tasks/store.ts`
2. For each task with `due_date`:
   - If within now+24h ±30min → send alert (key `{taskId}:due-24h`)
   - If within now+1h ±10min → send alert (key `{taskId}:due-1h`)
   - If `due_date` < now → send overdue alert (key `{taskId}:overdue:{YYYY-MM-DD}`)
3. Update `data/notifications-sent.json`

Dedup key examples: `a3f9k2mw:due-24h`, `a3f9k2mw:overdue:2026-05-31`.

### Module Boundaries

`telegram/` imports from `tasks/store.ts` directly (same process). No HTTP between modules. `tasks/` has zero knowledge of `telegram/`.

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
backend     ← Express API: tasks + telegram webhook + notifications (port 3000, internal)
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

```cron
# /etc/cron.d/marknext
0 * * * * root curl -s -X POST https://yourdomain.com/api/notifications/check \
  -H "X-Cron-Secret: ${CRON_SECRET}"
```

Backend `telegram/middleware.ts` validates `X-Cron-Secret` header.

### Environment Variables

```bash
# .env.example
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram
CRON_SECRET=
DATA_DIR=/app/data/tasks
PORT=3000
NODE_ENV=production
```

### Data Persistence

```
./data/                          ← git-ignored, bind-mounted into backend container
  tasks/                         ← markdown task files
  notifications-sent.json        ← notification dedup state
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
- `backend/` — Node.js + Express + TypeScript (tasks + telegram modules)
- `backend/src/tasks/store.ts` — markdown file I/O engine
- `backend/src/telegram/` — grammy bot, commands, notifier (modular, same container)
- `docker-compose.yml` + `Dockerfile` (backend only; frontend static)
- `nginx/` — nginx config with auth + webhook routing
- `.env.example`
- `docs/` — deployment guide + API reference
