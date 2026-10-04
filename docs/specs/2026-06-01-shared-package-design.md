# NexKan Shared Package — Architecture Design

**Date:** 2026-06-01  
**Goal:** Eliminate code duplication between frontend and backend by extracting shared types, utilities, and domain logic into a dedicated `@nexkan/shared` npm workspace package.

---

## Problem

Three categories of duplication exist between `backend/` and `frontend/`:

1. **Identical type definitions** — `types/task.ts` is maintained separately in both packages. A type change requires two edits and can silently diverge.
2. **Identical utility code** — `lib/date.ts` (`parseLocalDate`, `formatDate`) is duplicated verbatim.
3. **Scattered business rules** — `requiresDueDate` logic appears in 4 places (store.ts ×2, move.ts, TaskDialog.tsx); `isOverdue` logic in 3 places (store.ts, TaskCard.tsx, DashboardPage.tsx); the valid-status list in 3 places (KanbanBoard.tsx, move.ts, router.ts).

---

## Solution: npm Workspaces Monorepo

Convert the repo to an npm workspaces monorepo with a `shared/` package. The root `package.json` declares three workspaces: `shared`, `backend`, `frontend`. npm creates `node_modules/@nexkan/shared` as a symlink to `shared/`, so both packages import with `from '@nexkan/shared'`.

---

## Repository Structure

```
NexKan/
├── package.json                  # root workspace: ["shared","backend","frontend"]
├── shared/
│   ├── package.json              # name: "@nexkan/shared"
│   ├── tsconfig.json             # composite:true, outDir:dist
│   └── src/
│       ├── index.ts              # barrel re-export
│       ├── types/task.ts         # Task, TaskStatus, TaskPriority, *Input, TaskFilters
│       ├── lib/date.ts           # parseLocalDate, formatDate
│       └── lib/task.ts           # TASK_STATUSES, requiresDueDate, isOverdue
├── backend/
│   ├── package.json              # add "@nexkan/shared":"*"
│   ├── tsconfig.json             # add baseUrl, paths, references
│   ├── Dockerfile                # updated for workspace build
│   └── src/
│       ├── types/task.ts         # DELETED — replaced by shared
│       └── lib/date.ts           # DELETED — replaced by shared
└── frontend/
    ├── package.json              # add "@nexkan/shared":"*"
    ├── tsconfig.app.json         # add paths
    ├── vite.config.ts            # add alias
    └── src/
        ├── types/task.ts         # DELETED — replaced by shared
        └── lib/date.ts           # DELETED — replaced by shared
```

---

## Shared Package Contents

### `shared/src/types/task.ts`

Merged union of both current copies. All fields, comments, and interfaces preserved. Source of truth for the entire type surface:

```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export interface Task { ... }
export interface CreateTaskInput { ... }
export interface UpdateTaskInput { ... }
export interface TaskFilters { ... }
```

### `shared/src/lib/date.ts`

Unchanged from current implementation:

```typescript
export function parseLocalDate(dateStr: string): Date  // YYYY-MM-DD → local midnight
export function formatDate(date: Date | string): string // → "dd MMM yyyy"
```

Depends on `date-fns` (listed as a dependency in `shared/package.json`).

### `shared/src/lib/task.ts`

New file consolidating domain rules:

```typescript
import { startOfDay } from 'date-fns';
import { parseLocalDate } from './date';
import type { TaskStatus } from '../types/task';

// Single source of truth for valid statuses — replaces STATUSES, VALID_STATUSES
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

// Replaces 4 separate inline checks across store.ts, move.ts, TaskDialog.tsx
export function requiresDueDate(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in-progress';
}

// Replaces 3 equivalent implementations in store.ts, TaskCard.tsx, DashboardPage.tsx
// today defaults to new Date() so callers can optionally pass a pre-computed value
export function isOverdue(
  dueDate: string,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (status === 'done') return false;
  return startOfDay(parseLocalDate(dueDate)) < startOfDay(today);
}
```

### `shared/src/index.ts`

```typescript
export * from './types/task';
export * from './lib/date';
export * from './lib/task';
```

### `shared/package.json`

```json
{
  "name": "@nexkan/shared",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": { "build": "tsc" },
  "dependencies": { "date-fns": "^3.6.0" }
}
```

### `shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

---

## TypeScript Configuration

### Backend `tsconfig.json` additions

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@nexkan/shared":   ["../shared/src/index.ts"],
      "@nexkan/shared/*": ["../shared/src/*"]
    }
  },
  "references": [{ "path": "../shared" }]
}
```

`rootDir` and `outDir` are unchanged (`./src` → `./dist`).

### Frontend `tsconfig.app.json` additions

```json
{
  "compilerOptions": {
    "paths": {
      "@/*":              ["./src/*"],
      "@nexkan/shared":   ["../shared/src/index.ts"],
      "@nexkan/shared/*": ["../shared/src/*"]
    }
  }
}
```

### Frontend `vite.config.ts` additions

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@nexkan/shared': path.resolve(__dirname, '../shared/src'),
  },
},
```

### Resolution matrix

| Context | How `@nexkan/shared` resolves |
|---|---|
| `ts-node-dev` (backend dev) | tsconfig `paths` → `../shared/src/index.ts` (compiled on-the-fly) |
| `vite dev` (frontend dev) | vite alias → `../shared/src/index.ts` (bundled on-the-fly) |
| `tsc -b` (backend prod build) | project reference → builds `shared/dist/` first, backend links against `.d.ts` |
| Node.js runtime | npm symlink → `shared/package.json#main` → `shared/dist/index.js` |

---

## Docker Changes

### `docker-compose.yml`

```yaml
backend:
  build:
    context: .                    # repo root — shared/ is now in build context
    dockerfile: backend/Dockerfile
```

### `backend/Dockerfile`

Two-stage build. Builder installs workspace deps (creating the `@nexkan/shared` symlink), builds shared, then builds backend. Runtime stage does a fresh prod-only install so symlinks resolve correctly.

```dockerfile
# ── Build stage ──────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

COPY package.json ./
COPY shared/package.json  ./shared/
COPY backend/package.json ./backend/

RUN npm install --workspace=@nexkan/shared --workspace=nexkan-backend

COPY shared/src         ./shared/src
COPY shared/tsconfig.json ./shared/
RUN npm run build --workspace=@nexkan/shared

COPY backend/src         ./backend/src
COPY backend/tsconfig.json ./backend/
RUN npm run build --workspace=nexkan-backend

# ── Runtime stage ─────────────────────────────────────────────
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json         ./
COPY shared/package.json  ./shared/
COPY backend/package.json ./backend/

RUN npm install --workspace=@nexkan/shared --workspace=nexkan-backend --omit=dev

COPY --from=builder /app/shared/dist    ./shared/dist
COPY --from=builder /app/backend/dist   ./backend/dist
COPY --from=builder /app/backend/scripts ./backend/scripts

RUN chmod +x backend/scripts/init-data.sh

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "./scripts/init-data.sh && node dist/server.js"]
```

The runtime `npm install` creates a fresh `node_modules/@nexkan/shared` symlink pointing to `/app/shared`, which has `dist/index.js` copied from the builder stage. No lockfile fragility.

---

## Consumer Import Changes

### Backend

Every file that imports from `../types/task` or `../lib/date` or contains inline domain logic:

| File | Change |
|---|---|
| `tasks/store.ts` | Import types + `requiresDueDate` + `isOverdue` from shared; delete `parseDateStr`; simplify overdue filter to `isOverdue(t.due_date, t.status, todayD)` |
| `tasks/router.ts` | Import types from shared |
| `tasks/parser.ts` | Import `Task` from shared |
| `telegram/notifier.ts` | Import `formatDate`, `parseLocalDate` from shared |
| `telegram/callbacks.ts` | Import `formatDate` from shared |
| `telegram/commands/move.ts` | Replace `VALID_STATUSES` with `TASK_STATUSES` from shared; replace inline `requiresDueDate` check with `requiresDueDate(status)` |
| `telegram/commands/add.ts` | Import `formatDate` from shared |
| `telegram/commands/task.ts` | Import `formatDate` from shared |
| `telegram/commands/tasks.ts` | Import `formatDate` from shared |
| `telegram/commands/today.ts` | Import `Task` from shared (no date utilities needed) |
| `telegram/commands/overdue.ts` | Import `formatDate` from shared |

### Frontend

| File | Change |
|---|---|
| `components/task/TaskCard.tsx` | Import `isOverdue` + `formatDate` + `parseLocalDate` from shared; delete local `isOverdue` fn |
| `components/task/TaskDetail.tsx` | Import `formatDate` from shared |
| `components/task/TaskDialog.tsx` | Import types + `requiresDueDate` from shared; delete inline check |
| `components/board/KanbanBoard.tsx` | Import `TaskStatus`, `TASK_STATUSES` from shared; replace `STATUSES` constant |
| `components/board/KanbanColumn.tsx` | Import `TaskStatus` from shared |
| `components/board/MobileColumnNav.tsx` | Import `TaskStatus` from shared |
| `components/dashboard/DeadlineList.tsx` | Import `formatDate` from shared |
| `components/dashboard/OverdueList.tsx` | Import `formatDate` from shared |
| `pages/BoardPage.tsx` | Import `TaskStatus`, `TaskFilters`, `Task` from shared |
| `pages/DashboardPage.tsx` | Import `isOverdue`, `formatDate`, `parseLocalDate` from shared; simplify filter lambdas |
| `hooks/useTasks.ts` | Import `TaskFilters` from shared |
| `hooks/useTaskMutation.ts` | Import `CreateTaskInput`, `UpdateTaskInput` from shared |
| `lib/api.ts` | Import types from shared |

### `store.ts` overdue filter before/after

```typescript
// Before: 3 separate inline implementations
if (filters.overdue) {
  result = result.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    return isBefore(parseDateStr(t.due_date), todayD);
  });
}

// After: shared isOverdue with pre-computed today
if (filters.overdue) {
  result = result.filter(t => t.due_date && isOverdue(t.due_date, t.status, todayD));
}
```

---

## Files Deleted

- `backend/src/types/task.ts`
- `backend/src/lib/date.ts`
- `frontend/src/types/task.ts`
- `frontend/src/lib/date.ts`

---

## Lockfile Migration

The two separate lockfiles (`backend/package-lock.json`, `frontend/package-lock.json`) are replaced by a single root `package-lock.json`. The root lockfile is generated by running `npm install` from the repo root after all `package.json` files are in place.

The old lockfiles are deleted.

---

## Testing

- Backend tests are unchanged in structure. After migration, `tsc --noEmit` and `npm test` must both pass.
- Frontend Vite build (`npm run build`) must pass with no TypeScript errors.
- Docker build (`docker build -f backend/Dockerfile .`) must produce a working image.
- Shared package has no test suite of its own — it is tested indirectly through backend and frontend tests.

---

## What Does NOT Change

- Backend API surface and behavior
- Frontend UI and routing
- nginx configuration
- `data/` directory layout
- Telegram bot commands
- Deployment scripts
