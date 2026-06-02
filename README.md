# NexKan

Personal Kanban board. Markdown files as storage. Telegram bot for remote access. Self-hosted, Raspberry Pi-friendly.

## Features

- **Board** — 4-column Kanban (Plan → Todo → In Progress → Done) with drag-and-drop reorder
- **Dashboard** — overdue tasks, due today/tomorrow, summary stats
- **Scratchpad** — save quick thoughts/reminders and easily convert them to cards later
- **Telegram bot** — create and manage tasks or scratchpad notes from your phone; natural language dates (`tomorrow`, `next monday`)
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
| `/note <text>` | Create scratchpad note |
| `/notes` | List all scratchpad notes |
| `/delnote <id>` | Delete a scratchpad note |
| `/help` | Command reference |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 24, Express 4, TypeScript |
| Storage | Markdown + YAML frontmatter via gray-matter |
| Telegram | grammy, chrono-node |
| Frontend | React 18, Vite 5, TanStack Query, dnd-kit |
| UI | Tailwind CSS, Radix UI |
| Infrastructure | Docker Compose, nginx |

## Assets & Branding

NexKan features a unified, minimalist flat-UI design layout centered around a terminal-frame and sliding Kanban-card logo:
- **Logo component** — Inline SVG vector implementation with interactive CSS entry animations ([Logo.tsx](frontend/src/components/shared/Logo.tsx)).
- **Favicons** — Scalable, high-DPI vector favicon ([favicon.svg](frontend/public/favicon.svg)) using inline Slate colors to guarantee cross-browser rendering compatibility on both light and dark browser tabs, plus multi-resolution legacy backup ([favicon.ico](frontend/public/favicon.ico)) and mobile bookmark graphics ([logo.png](frontend/public/logo.png)).
- **Version Pill** — Rendered in the header next to the brand name as a compact, brand-colored pill reflecting the current CalVer release.

## Versioning & Releases

NexKan uses Calendar Versioning (**CalVer**) with the scheme `YYYY.M.PATCH`:
- `YYYY` — Year
- `M` — Month (1-12)
- `PATCH` — Minor patch/fix incrementer, which resets to `1` when the calendar month or year transitions (e.g. `2026.5.4` → `2026.6.1` → `2026.6.2`).

### Storing and Syncing Versions
- The single source of truth is the root `package.json`'s version.
- Running `node scripts/sync-version.js [VERSION]` syncs the root version to all package workspaces (`backend/package.json`, `frontend/package.json`, `shared/package.json`), updates `package-lock.json`, writes the version dynamically to a shared typescript module ([version.ts](shared/src/lib/version.ts)), and compiles the shared package automatically.
- If no version argument is specified, `sync-version.js` automatically calculates the next version based on today's calendar date and the current package version.

### Preparing a Release
- Run `node scripts/release.js [VERSION]` to automatically sync versions, build workspace modules, and output branch-aware git commands to commit, tag, and push the release.

## Documentation

- [Deployment guide](docs/deployment.md) — setup, HTTPS, cron, updates, troubleshooting
- [API reference](docs/api.md) — all REST endpoints, query params, request/response shapes

