# NexKan

Personal Kanban board. Markdown files as storage. Telegram bot for remote access. Self-hosted, runs on a Raspberry Pi.

## What it is

- **Board view** — 4-column Kanban (Plan → Todo → In Progress → Done) with drag-and-drop reorder
- **Dashboard** — overdue tasks, due today/tomorrow, stats
- **Telegram bot** — create and manage tasks from your phone
- **Notifications** — daily due-date alerts via Telegram (cron-triggered)
- **No database** — each task is a markdown file with YAML frontmatter

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript |
| Storage | Markdown files with gray-matter frontmatter |
| Telegram | grammy, chrono-node |
| Frontend | React 18, Vite 5, TanStack Query, dnd-kit |
| UI | Tailwind CSS, Radix UI (shadcn-style) |
| Infra | Docker Compose, nginx (basic auth + TLS termination) |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- A domain with HTTPS (or local HTTP for dev)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### 1. Clone and configure

```bash
git clone <repo-url>
cd NexKan

cp backend/.env.example .env
# Edit .env — fill in Telegram values (see Configuration below)
```

### 2. Initialize data directories

```bash
mkdir -p data/tasks
echo '{}' > data/notifications-sent.json
```

### 3. Build the frontend

```bash
cd frontend && npm install && npm run build
cd ..
```

### 4. Create nginx credentials

```bash
# Replace 'yourpassword' with a strong password
docker run --rm httpd:alpine htpasswd -nb admin yourpassword > nginx/.htpasswd
```

### 5. Start

```bash
docker compose up --build -d
docker compose logs -f
```

The board is at `http://yourdomain.com` (or `http://localhost` for local). Login with the credentials from step 4.

---

## Configuration

All config lives in `.env` at the project root (not committed).

```bash
# Server
PORT=3000
NODE_ENV=production
TZ=Europe/Berlin          # Server timezone for due-date comparisons

# Data paths (inside container — don't change unless you change docker-compose volumes)
DATA_DIR=/app/data/tasks
NOTIFICATIONS_FILE=/app/data/notifications-sent.json

# Telegram
TELEGRAM_BOT_TOKEN=       # From @BotFather
TELEGRAM_CHAT_ID=         # Your personal chat ID (get from @userinfobot)
TELEGRAM_WEBHOOK_SECRET=  # Random string — must match what you tell Telegram
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram
CRON_SECRET=              # Random string — used by the daily cron job
```

Generate secrets:
```bash
openssl rand -hex 32   # Run twice — once for WEBHOOK_SECRET, once for CRON_SECRET
```

---

## Telegram Setup

**1. Create a bot** — message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.

**2. Find your chat ID** — message [@userinfobot](https://t.me/userinfobot) → copy the ID into `TELEGRAM_CHAT_ID`.

**3. Register the webhook** — the backend registers it automatically on startup if `TELEGRAM_BOT_TOKEN` is set. You can verify with:

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**4. Set up daily notifications** — add a cron job on the host:

```bash
# Save CRON_SECRET to a file (so cron can read it without .env expansion issues)
echo "$CRON_SECRET" > /etc/nexkan/cron-secret
chmod 600 /etc/nexkan/cron-secret

# Add to /etc/cron.d/nexkan
echo '0 8 * * * root curl -s -X POST https://yourdomain.com/api/notifications/check \
  -H "X-Cron-Secret: $(cat /etc/nexkan/cron-secret)"' > /etc/cron.d/nexkan
```

### Bot commands

| Command | What it does |
|---------|-------------|
| `/add <title> [date]` | Create task. Date accepts ISO (`2026-06-01`) or natural language (`tomorrow`, `next monday`) |
| `/tasks` | List all non-done tasks, grouped by status |
| `/today` | Tasks due today |
| `/overdue` | Tasks past their due date |
| `/task <id>` | Task detail + inline action buttons |
| `/move <id> <status>` | Move task between columns |
| `/help` | Command reference |

---

## Development

### Backend

```bash
cd backend
npm install

# Run with hot reload
DATA_DIR=/tmp/nexkan-dev npm run dev

# Tests
npm test
```

Backend runs on `http://localhost:3000`. All endpoints under `/api/`.

### Frontend

```bash
cd frontend
npm install

# Dev server (proxies /api to localhost:3000)
npm run dev

# Production build
npm run build
```

Frontend dev server runs on `http://localhost:5173`.

### Project structure

```
NexKan/
├── backend/
│   ├── src/
│   │   ├── tasks/
│   │   │   ├── parser.ts       ← markdown ↔ Task object
│   │   │   ├── store.ts        ← all file I/O (read/write/delete)
│   │   │   └── router.ts       ← REST endpoints
│   │   ├── telegram/
│   │   │   ├── bot.ts          ← grammy singleton + webhook registration
│   │   │   ├── commands/       ← one file per bot command
│   │   │   ├── callbacks.ts    ← inline button handler
│   │   │   ├── notifier.ts     ← due-date notification logic
│   │   │   ├── middleware.ts   ← webhook + cron auth
│   │   │   └── router.ts       ← Express routes for Telegram endpoints
│   │   ├── types/task.ts       ← shared TypeScript interfaces
│   │   ├── app.ts              ← Express app (no server.listen)
│   │   └── server.ts           ← entry point
│   ├── tests/                  ← Jest + supertest tests
│   └── scripts/init-data.sh   ← creates data/ dirs on first run
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── board/          ← KanbanBoard, KanbanColumn
│       │   ├── task/           ← TaskCard, TaskDetail, TaskDialog
│       │   ├── dashboard/      ← StatsCard, DeadlineList, OverdueList
│       │   ├── shared/         ← FilterBar, PriorityBadge, TagBadge
│       │   └── ui/             ← Button, Badge, Dialog, Input, Label
│       ├── hooks/              ← TanStack Query wrappers
│       ├── lib/                ← api.ts (fetch wrappers), utils.ts
│       ├── pages/              ← BoardPage, DashboardPage
│       └── types/task.ts       ← frontend Task interfaces
├── nginx/
│   ├── Dockerfile
│   └── nexkan.conf             ← auth routing, webhook bypass
├── data/                       ← git-ignored, bind-mounted into container
│   ├── tasks/                  ← markdown task files
│   └── notifications-sent.json
├── docker-compose.yml
└── .env                        ← git-ignored, create from backend/.env.example
```

---

## Task file format

Each task is stored as a markdown file in `data/tasks/`. Filename: `{id}-{slug}.md`.

```markdown
---
id: a3f9k2mw
title: Buy groceries
status: todo
priority: high
tags:
  - shopping
  - personal
due_date: "2026-06-01"
sort_order: 3
created_at: "2026-05-15T10:30:00Z"
updated_at: "2026-05-16T08:00:00Z"
---

## Description

Buy milk, eggs, bread from the market.

## Notes

Check discount aisle for olive oil.
```

**Status values:** `plan` · `todo` · `in-progress` · `done`

**Due date rule:** `todo` and `in-progress` tasks must have a `due_date`. Moving a task to either of these columns without one is rejected with HTTP 400 / Telegram prompt.

---

## Backup

The `data/` directory contains everything. Back it up with:

```bash
# Simple rsync snapshot
rsync -av data/ /backup/nexkan-$(date +%Y%m%d)/

# Or git-based
cd data && git init && git add . && git commit -m "snapshot"
```

---

## HTTPS / TLS

nginx currently listens on port 80. For production:

1. Add TLS certs to `nginx/certs/`
2. Update `nginx/nexkan.conf` to listen on 443 with `ssl_certificate` directives
3. Update `docker-compose.yml` to expose `443:443`

Or put a reverse proxy (Caddy, Traefik, Cloudflare Tunnel) in front — nginx handles only the inner routing.

---

## API reference

See [`docs/api.md`](docs/api.md).
