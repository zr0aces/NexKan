# Scratchpad (Sticky Notes) — Design Spec

**Date:** 2026-06-01  
**Status:** Approved

---

## Overview

A lightweight scratchpad for quickly capturing freeform notes while managing tasks. Notes are independent sticky notes (not tasks), displayed as a persistent panel below the Kanban board on both Board and Dashboard pages. Any note can be promoted to a Kanban task and is deleted upon conversion.

---

## Data Model & Storage

### `Note` type (added to `@nexkan/shared`)

```ts
export interface Note {
  id: string;       // 8-char nanoid
  content: string;  // freeform text, no title
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

### Storage

- Directory: `data/scratchpad/` (separate from `data/tasks/`)
- One file per note: `{id}.md` (no slug — notes have no title)
- Format: gray-matter YAML frontmatter + plain text body

```markdown
---
id: abc12345
created_at: 2026-06-01T10:00:00.000Z
updated_at: 2026-06-01T10:00:00.000Z
---

Buy milk and call dentist
```

---

## Backend

### New module: `backend/src/scratchpad/`

| File | Responsibility |
|------|----------------|
| `parser.ts` | Serialize/deserialize note markdown via gray-matter |
| `store.ts` | CRUD over `data/scratchpad/` dir |
| `router.ts` | REST endpoints, Zod-validated inputs |

### `store.ts` functions

- `readAll()` → `Note[]` sorted `created_at` desc
- `create(content: string)` → `Note`
- `update(id: string, content: string)` → `Note`
- `deleteNote(id: string)` → `void`

### REST API — mounted at `/api/notes` in `app.ts`

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/notes` | — | `Note[]` |
| `POST` | `/api/notes` | `{ content: string }` | `Note` |
| `PATCH` | `/api/notes/:id` | `{ content: string }` | `Note` |
| `DELETE` | `/api/notes/:id` | — | `204` |
| `POST` | `/api/notes/:id/convert` | `{ due_date?: string, priority?: TaskPriority, status?: TaskStatus }` | `Task` |

### Convert-to-task logic

1. Read note by id
2. Split content: first line → task `title`, remainder → task `description`
3. Call `tasks/store.create()` with title, description, and any supplied due_date/priority/status
4. Call `scratchpad/store.deleteNote(id)`
5. Return the created `Task`

All inputs Zod-validated. Errors follow existing task router patterns (400 for validation, 404 for not found).

---

## Frontend

### New files

| Path | Responsibility |
|------|----------------|
| `src/hooks/useNotes.ts` | TanStack Query fetch, mirrors `useTasks` |
| `src/hooks/useNoteMutation.ts` | create/update/delete/convert mutations with cache invalidation |
| `src/components/scratchpad/ScratchpadPanel.tsx` | Panel wrapper — title, note grid, add button |
| `src/components/scratchpad/NoteCard.tsx` | Individual sticky: inline edit, delete, convert |
| `src/components/scratchpad/ConvertDialog.tsx` | Modal for due_date + priority before conversion |
| `src/components/scratchpad/AddNoteButton.tsx` | "+" creates blank note, focuses it |

New API calls added to `src/lib/api.ts`.

### UX

- `<ScratchpadPanel />` renders below the Kanban board on **both** `BoardPage` and `DashboardPage`
- Panel is always visible (no toggle)
- Notes displayed newest-first in a horizontal-scroll row of cards
- Click note body → editable `<textarea>`, auto-saves on blur
- "Convert to Task" button on each card → opens `ConvertDialog` (due_date + priority inputs; status always defaults to `todo`) → fires convert endpoint → invalidates both notes and tasks query cache
- Delete button on each card → fires delete, optimistic removal

---

## Telegram Integration

Three new commands in `backend/src/telegram/commands/`:

| Command | Behaviour |
|---------|-----------|
| `/note <text>` | Creates a scratchpad note; replies with id + content preview |
| `/notes` | Lists all notes, numbered, showing first 60 chars of content |
| `/delnote <id>` | Deletes note by id; confirms deletion |

All commands registered in `bot.ts`, guarded by existing `TELEGRAM_CHAT_ID` middleware.

**No dedicated Telegram convert command.** Convert-to-task requires due_date/priority which are better collected via the UI dialog. Users who want to convert from Telegram should use `/add <title> <date>` to create the task directly.

---

## Key Invariants

- Note filename: `{8-char-nanoid}.md`. Store uses exact filename match (no prefix search needed — no slug).
- `content` stored as raw markdown body; no sanitization (single-user personal tool).
- Convert is atomic from the caller's perspective: task created first, note deleted second. On task creation failure, note is preserved.
- `due_date` rule from shared (`requiresDueDate()`) still enforced on task created by convert endpoint.
