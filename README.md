# NexKan

NexKan is a lightweight, self-hosted personal Kanban board designed to run efficiently on low-resource hardware like a Raspberry Pi or a Linux VPS. It uses local Markdown files with YAML frontmatter for data storage, eliminating the need for a database, and integrates a powerful Telegram bot for remote management.

---

## Overview

NexKan is built for developers and self-hosters who value data ownership and simplicity. By storing task cards in plain Markdown files:
- **No Database Administration**: Avoid database installation, migration, and management overhead. Tasks are stored directly in `data/tasks/` as human-readable `.md` files.
- **Native Backups & Synchronization**: Since tasks are text files, backups can be completed using standard system commands like `rsync`, `rclone`, or a simple Git repository.
- **Bi-directional Client Access**: Access your Kanban board using either the modern React desktop web interface or the integrated Telegram bot interface when on the go.

---

## Features

- **Board** — 3-column Kanban layout (Todo → In Progress → Done) with drag-and-drop reordering powered by `dnd-kit`.
- **Dashboard** — Visual overview of overdue tasks, tasks due today/tomorrow, and board completion statistics.
- **Scratchpad** — Save quick thoughts, snippets, or notes that can be easily converted into full Kanban cards later.
- **Telegram Bot** — Create and manage cards, write notes, and list schedules from your phone.
- **Daily Alerts** — Automatic Telegram notifications for due and overdue tasks triggered via cron.

---

## Telegram Bot Commands

NexKan includes an integrated Telegram bot (built with `grammy`) that serves as a mobile client. Access to the bot is restricted to your authorized account or group chat ID via the `TELEGRAM_CHAT_ID` environment variable.

### Task Commands
| Command | Parameter | Action |
|---------|-----------|--------|
| `/add` | `<title> [date]` | Create a new task. Supports natural language dates (e.g. `/add Call dentist tomorrow` or `/add Submit report next monday`). |
| `/tasks` | *None* | List all active (non-done) tasks grouped by column. |
| `/today` | *None* | List all tasks due today. |
| `/overdue` | *None* | List all overdue tasks. |
| `/task` | `<id>` | Display a detailed view of a task including description, priority, tags, and inline action buttons (Move to column, etc.). |
| `/move` | `<id> <status>` | Move a task to a new status (`todo` \| `in-progress` \| `done`). |

### Scratchpad Commands
| Command | Parameter | Action |
|---------|-----------|--------|
| `/note` | `<text>` | Save a quick text snippet to your Scratchpad. |
| `/notes` | *None* | List all Scratchpad notes. |
| `/delnote`| `<id>` | Delete a Scratchpad note by ID. |

### Utility Commands
| Command | Action |
|---------|--------|
| `/help` | Display command reference and bot usage instructions. |

> 💡 **Natural Language Dates**: The `/add` command uses `chrono-node` to parse dates. You can write relative terms like `tomorrow`, `next friday`, `in 3 days`, or absolute dates like `2026-06-15`.

---

## Tech Stack

NexKan is organized as an **npm monorepo workspace** consisting of three packages:
- `shared/` (`@nexkan/shared`) — Shared type definitions, domain logic (such as due-date invariants), and local date helpers.
- `backend/` (`nexkan-backend`) — Node.js 24 / Express 4 API server and Grammy Telegram bot.
- `frontend/` (`nexkan-frontend`) — React 18 / Vite 7 single-page application.

| Component | Technologies Used | Description |
|-----------|-------------------|-------------|
| **Frontend** | React 18, Vite 7, TanStack Query v5, dnd-kit | Single Page App with optimistic UI mutations, theme switcher, and drag-and-drop. |
| **Backend** | Express 4, TypeScript, Zod | REST API server with validation and Telegram webhook endpoints. |
| **Storage** | Markdown, YAML frontmatter, `gray-matter` | Tasks are parsed to/from `.md` files; scratchpad notes are stored in `data/scratchpad/`. |
| **Telegram** | grammy, chrono-node | Webhook-driven bot with interactive inline button callbacks and natural language date parsing. |
| **Styling** | Tailwind CSS v3, Radix UI | Dark/light mode theme system with responsive custom Tailwind keyframe animations. |
| **Deployment** | Docker Compose, nginx | Multi-architecture containers (`node:24-slim`) designed to run on `amd64`, `arm64`, and `arm/v7` (Raspberry Pi). |

---

## Assets & Branding

NexKan features a unified, minimalist flat-UI design layout centered around a terminal-frame and sliding Kanban-card logo:
- **Logo component** — Inline SVG vector implementation with interactive CSS entry animations ([Logo.tsx](frontend/src/components/shared/Logo.tsx)).
- **Favicons** — Scalable, high-DPI vector favicon ([favicon.svg](frontend/public/favicon.svg)) using inline Slate colors to guarantee cross-browser rendering compatibility on both light and dark browser tabs, plus multi-resolution legacy backup ([favicon.ico](frontend/public/favicon.ico)) and mobile bookmark graphics ([logo.png](frontend/public/logo.png)).
- **Version Pill** — Rendered in the header next to the brand name as a compact, brand-colored pill reflecting the current CalVer release.

---

## Documentation

- [Deployment guide](docs/deployment.md) — Setup, HTTPS, cron, updates, troubleshooting
- [API reference](docs/api.md) — All REST endpoints, query params, request/response shapes
- [Versioning & releases guide](docs/versioning.md) — CalVer scheme, syncing, release script
