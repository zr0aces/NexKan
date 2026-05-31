# NexKan

Personal Kanban board. Markdown files as storage. Telegram bot for remote access. Self-hosted, Raspberry Pi-friendly.

## Features

- **Board** — 4-column Kanban (Plan → Todo → In Progress → Done) with drag-and-drop reorder
- **Dashboard** — overdue tasks, due today/tomorrow, summary stats
- **Telegram bot** — create and manage tasks from your phone; natural language dates (`tomorrow`, `next monday`)
- **Notifications** — daily due-date alerts via Telegram, cron-triggered, deduplicated
- **No database** — each task is a markdown file with YAML frontmatter; back up with rsync or git

## Telegram commands

| Command | Action |
|---------|--------|
| `/add <title> [date]` | Create task |
| `/tasks` | List non-done tasks by status |
| `/today` | Tasks due today |
| `/overdue` | Overdue tasks |
| `/task <id>` | Detail view + inline action buttons |
| `/move <id> <status>` | Move between columns |
| `/help` | Command reference |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript |
| Storage | Markdown + YAML frontmatter via gray-matter |
| Telegram | grammy, chrono-node |
| Frontend | React 18, Vite 5, TanStack Query, dnd-kit |
| UI | Tailwind CSS, Radix UI |
| Infrastructure | Docker Compose, nginx |

## Documentation

- [Deployment guide](docs/deployment.md) — setup, HTTPS, cron, updates, troubleshooting
- [API reference](docs/api.md) — all REST endpoints, query params, request/response shapes
