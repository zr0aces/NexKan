# Shared Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared types, date utilities, and domain business rules into `@nexkan/shared` npm workspace package, eliminating all duplication between backend and frontend.

**Architecture:** npm workspaces monorepo (`shared`, `backend`, `frontend`). TypeScript project references + tsconfig `paths` resolve `@nexkan/shared` to source at dev/typecheck time; npm workspace symlink + compiled `shared/dist/` resolve it at Node.js runtime. Docker build context widens to repo root so `shared/` is available during container build.

**Tech Stack:** npm workspaces, TypeScript 5.9 project references, date-fns ^3.6.0, ts-node-dev, Vite, Node.js 24.

> **Note:** The frontend has no unit-test framework. Verification for frontend tasks is `npm run build` (TypeScript + Vite). Backend verification is `npx tsc --noEmit && npm test`.

---

### Task 1: Root workspace + `@nexkan/shared` scaffold

**Files:**
- Create: `package.json` (repo root)
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/` directory structure
- Delete: `backend/package-lock.json`, `frontend/package-lock.json`
- Generate: `package-lock.json` (repo root)

- [ ] **Step 1: Create root `package.json`**

Create `/home/san/workspace/NexKan/package.json`:
```json
{
  "name": "nexkan",
  "private": true,
  "workspaces": ["shared", "backend", "frontend"]
}
```

- [ ] **Step 2: Create `shared/package.json`**

Create `/home/san/workspace/NexKan/shared/package.json`:
```json
{
  "name": "@nexkan/shared",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch"
  },
  "dependencies": {
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: Create `shared/tsconfig.json`**

Create `/home/san/workspace/NexKan/shared/tsconfig.json`:
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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create shared source directories**

```bash
mkdir -p /home/san/workspace/NexKan/shared/src/types
mkdir -p /home/san/workspace/NexKan/shared/src/lib
```

- [ ] **Step 5: Delete old per-package lockfiles and generate root lockfile**

```bash
cd /home/san/workspace/NexKan
rm backend/package-lock.json frontend/package-lock.json
npm install
```

Expected: `node_modules/` at repo root, no errors. Verify the workspace symlink:
```bash
ls -la node_modules/@nexkan/
```
Expected: `shared -> ../../shared`

- [ ] **Step 6: Add `shared/dist/` to .gitignore**

In `/home/san/workspace/NexKan/.gitignore`, add one line:
```
shared/dist/
```

- [ ] **Step 7: Commit**

```bash
cd /home/san/workspace/NexKan
git add package.json shared/package.json shared/tsconfig.json .gitignore
git add package-lock.json
git rm backend/package-lock.json frontend/package-lock.json
git commit -m "chore: add npm workspaces root and @nexkan/shared scaffold"
```

---

### Task 2: `shared/src/types/task.ts`

**Files:**
- Create: `shared/src/types/task.ts`

- [ ] **Step 1: Create the canonical types file**

Create `/home/san/workspace/NexKan/shared/src/types/task.ts`. This is the merged union of both existing copies — take all fields from both, keep the richer backend comments:

```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  due_date?: string;            // YYYY-MM-DD
  sort_order: number;
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
  telegram_message_id?: number;
  attachments: string[];
  description: string;          // content under ## Description heading
  notes?: string;               // content under ## Notes heading
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: TaskPriority;
  tags?: string[];
  status?: TaskStatus;          // defaults to 'todo'
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string | null;     // null clears the field
  priority?: TaskPriority;
  tags?: string[];
  sort_order?: number;
  telegram_message_id?: number;
}

export interface TaskFilters {
  status?: string;              // single status or comma-separated list
  tags?: string;                // comma-separated, OR logic
  priority?: TaskPriority;
  overdue?: boolean;            // due_date < today && status !== done
  due_today?: boolean;          // due_date === today
  due_tomorrow?: boolean;       // due_date === today + 1
  search?: string;              // searches title and tags
  sort?: string;                // see API sort options
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/types/task.ts
git commit -m "feat(shared): add Task types"
```

---

### Task 3: `shared/src/lib/date.ts`

**Files:**
- Create: `shared/src/lib/date.ts`

- [ ] **Step 1: Create date utility**

Create `/home/san/workspace/NexKan/shared/src/lib/date.ts`. This is identical to both current per-package copies:

```typescript
import { parse, format } from 'date-fns';

const STORAGE_FORMAT = 'yyyy-MM-dd';

/**
 * Parse a stored YYYY-MM-DD string as LOCAL midnight.
 *
 * Uses parse() with an explicit format token instead of parseISO() to
 * guarantee local-time interpretation regardless of date-fns version.
 * (date-fns v2 parseISO treated date-only strings as UTC midnight, which
 * would shift the displayed date by ±1 day in UTC-negative timezones.)
 *
 * The server's local timezone is controlled by the TZ environment variable.
 * It must be set to the user's timezone for overdue/due-today/due-tomorrow
 * classifications to match what the user sees in their browser.
 */
export function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, STORAGE_FORMAT, new Date());
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return format(d, 'dd MMM yyyy');
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/lib/date.ts
git commit -m "feat(shared): add date utilities"
```

---

### Task 4: `shared/src/lib/task.ts`

**Files:**
- Create: `shared/src/lib/task.ts`

- [ ] **Step 1: Create domain business rules**

Create `/home/san/workspace/NexKan/shared/src/lib/task.ts`:

```typescript
import { startOfDay } from 'date-fns';
import { parseLocalDate } from './date';
import type { TaskStatus } from '../types/task';

/** Single source of truth for valid task statuses. */
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

/**
 * Returns true if moving a task to `status` requires a due date.
 * Replaces 4 separate inline checks: store.ts×2, move.ts, TaskDialog.tsx.
 */
export function requiresDueDate(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in-progress';
}

/**
 * Returns true if the task is overdue (due date before today, status not done).
 * Replaces 3 equivalent implementations: store.ts, TaskCard.tsx, DashboardPage.tsx.
 *
 * @param dueDate  YYYY-MM-DD stored date string
 * @param status   Current task status
 * @param today    Reference date (defaults to now; pass pre-computed value for batch ops)
 */
export function isOverdue(
  dueDate: string,
  status: TaskStatus,
  today: Date = new Date()
): boolean {
  if (status === 'done') return false;
  return startOfDay(parseLocalDate(dueDate)) < startOfDay(today);
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/lib/task.ts
git commit -m "feat(shared): add domain rules (TASK_STATUSES, requiresDueDate, isOverdue)"
```

---

### Task 5: Barrel export + build shared

**Files:**
- Create: `shared/src/index.ts`

- [ ] **Step 1: Create barrel**

Create `/home/san/workspace/NexKan/shared/src/index.ts`:

```typescript
export * from './types/task';
export * from './lib/date';
export * from './lib/task';
```

- [ ] **Step 2: Build and verify**

```bash
cd /home/san/workspace/NexKan/shared
npm run build
```

Expected: `shared/dist/` created with `index.js`, `index.d.ts`, plus sub-files for types/ and lib/. No errors.

```bash
ls shared/dist/
```
Expected output includes: `index.js  index.d.ts  lib/  types/`

- [ ] **Step 3: Commit**

```bash
cd /home/san/workspace/NexKan
git add shared/src/index.ts
git commit -m "feat(shared): add barrel export; shared package complete"
```

---

### Task 6: Wire backend to `@nexkan/shared`

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/tsconfig.json`
- Modify: `backend/jest.config.js`
- Modify: `backend/src/tasks/store.ts`
- Modify: `backend/src/tasks/router.ts`
- Modify: `backend/src/tasks/parser.ts`
- Modify: `backend/src/telegram/notifier.ts`
- Modify: `backend/src/telegram/callbacks.ts`
- Modify: `backend/src/telegram/commands/add.ts`
- Modify: `backend/src/telegram/commands/task.ts`
- Modify: `backend/src/telegram/commands/tasks.ts`
- Modify: `backend/src/telegram/commands/today.ts`
- Modify: `backend/src/telegram/commands/overdue.ts`
- Modify: `backend/src/telegram/commands/move.ts`
- Delete: `backend/src/types/task.ts`
- Delete: `backend/src/lib/date.ts`

- [ ] **Step 1: Add @nexkan/shared to backend/package.json dependencies**

In `backend/package.json`, add to the `"dependencies"` object:
```json
"@nexkan/shared": "*"
```

Run from repo root:
```bash
cd /home/san/workspace/NexKan && npm install
```

Expected: no errors.

- [ ] **Step 2: Replace backend/tsconfig.json**

Replace the full content of `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@nexkan/shared":   ["../shared/src/index.ts"],
      "@nexkan/shared/*": ["../shared/src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 3: Replace backend/jest.config.js**

Replace the full content of `backend/jest.config.js` (current has preset, testEnvironment, roots, testMatch, testTimeout — keep all, add moduleNameMapper):

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@nexkan/shared$': '<rootDir>/../shared/src/index.ts',
    '^@nexkan/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
};
```

- [ ] **Step 4: Update backend/src/tasks/store.ts — imports**

Change line 5 from:
```typescript
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '../types/task';
```
To:
```typescript
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '@nexkan/shared';
```

Change line 7 from:
```typescript
import { parseLocalDate } from '../lib/date';
```
To:
```typescript
import { parseLocalDate } from '@nexkan/shared';
```

- [ ] **Step 5: Update backend/src/tasks/router.ts — imports**

Change the line:
```typescript
import { TaskFilters } from '../types/task';
```
To:
```typescript
import { TaskFilters } from '@nexkan/shared';
```

- [ ] **Step 6: Update backend/src/tasks/parser.ts — imports**

Change the line:
```typescript
import { Task } from '../types/task';
```
To:
```typescript
import { Task } from '@nexkan/shared';
```

- [ ] **Step 7: Update backend/src/telegram/notifier.ts — imports**

Change the line:
```typescript
import { parseLocalDate, formatDate } from '../lib/date';
```
To:
```typescript
import { parseLocalDate, formatDate } from '@nexkan/shared';
```

- [ ] **Step 8: Update backend/src/telegram/callbacks.ts — imports**

Change the line:
```typescript
import { formatDate } from '../lib/date';
```
To:
```typescript
import { formatDate } from '@nexkan/shared';
```

- [ ] **Step 9: Update backend/src/telegram/commands/add.ts — imports**

Change the line:
```typescript
import { formatDate } from '../../lib/date';
```
To:
```typescript
import { formatDate } from '@nexkan/shared';
```

- [ ] **Step 10: Update backend/src/telegram/commands/task.ts — imports**

Change the line:
```typescript
import { formatDate } from '../../lib/date';
```
To:
```typescript
import { formatDate } from '@nexkan/shared';
```

- [ ] **Step 11: Update backend/src/telegram/commands/tasks.ts — imports**

Replace the three import lines at the top:
```typescript
import { Task } from '../../types/task';
import { escapeMd } from '../utils';
import { formatDate } from '../../lib/date';
```
With (consolidated into two lines):
```typescript
import { Task, formatDate } from '@nexkan/shared';
import { escapeMd } from '../utils';
```

- [ ] **Step 12: Update backend/src/telegram/commands/today.ts — imports**

Change the line:
```typescript
import { Task } from '../../types/task';
```
To:
```typescript
import { Task } from '@nexkan/shared';
```

- [ ] **Step 13: Update backend/src/telegram/commands/overdue.ts — imports**

Replace the three import lines at the top:
```typescript
import { Task } from '../../types/task';
import { escapeMd } from '../utils';
import { formatDate } from '../../lib/date';
```
With:
```typescript
import { Task, formatDate } from '@nexkan/shared';
import { escapeMd } from '../utils';
```

- [ ] **Step 14: Update backend/src/telegram/commands/move.ts — imports**

Change the line:
```typescript
import { TaskStatus } from '../../types/task';
```
To:
```typescript
import { TaskStatus } from '@nexkan/shared';
```

- [ ] **Step 15: Delete local backend copies**

```bash
rm backend/src/types/task.ts backend/src/lib/date.ts
```

- [ ] **Step 16: Verify TypeScript compiles**

```bash
cd /home/san/workspace/NexKan/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 17: Run backend tests**

```bash
npm test
```

Expected: `Tests: 72 passed, 72 total`

- [ ] **Step 18: Commit**

```bash
cd /home/san/workspace/NexKan
git add backend/package.json backend/tsconfig.json backend/jest.config.js
git add backend/src/tasks/store.ts backend/src/tasks/router.ts backend/src/tasks/parser.ts
git add backend/src/telegram/notifier.ts backend/src/telegram/callbacks.ts
git add backend/src/telegram/commands/add.ts backend/src/telegram/commands/task.ts
git add backend/src/telegram/commands/tasks.ts backend/src/telegram/commands/today.ts
git add backend/src/telegram/commands/overdue.ts backend/src/telegram/commands/move.ts
git rm backend/src/types/task.ts backend/src/lib/date.ts
git add package-lock.json
git commit -m "feat(backend): wire @nexkan/shared types and utilities"
```

---

### Task 7: Wire frontend to `@nexkan/shared`

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/useTasks.ts`
- Modify: `frontend/src/hooks/useTaskMutation.ts`
- Modify: `frontend/src/pages/BoardPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/board/KanbanBoard.tsx`
- Modify: `frontend/src/components/board/KanbanColumn.tsx`
- Modify: `frontend/src/components/board/MobileColumnNav.tsx`
- Modify: `frontend/src/components/task/TaskCard.tsx`
- Modify: `frontend/src/components/task/TaskDetail.tsx`
- Modify: `frontend/src/components/task/TaskDialog.tsx`
- Modify: `frontend/src/components/dashboard/DeadlineList.tsx`
- Modify: `frontend/src/components/dashboard/OverdueList.tsx`
- Delete: `frontend/src/types/task.ts`
- Delete: `frontend/src/lib/date.ts`

- [ ] **Step 1: Add @nexkan/shared to frontend/package.json dependencies**

In `frontend/package.json`, add to `"dependencies"`:
```json
"@nexkan/shared": "*"
```

Run from repo root:
```bash
cd /home/san/workspace/NexKan && npm install
```

- [ ] **Step 2: Update frontend/tsconfig.app.json — add paths**

In `frontend/tsconfig.app.json`, update `compilerOptions.paths` to:
```json
"paths": {
  "@/*":              ["./src/*"],
  "@nexkan/shared":   ["../shared/src/index.ts"],
  "@nexkan/shared/*": ["../shared/src/*"]
}
```

- [ ] **Step 3: Update frontend/vite.config.ts — add alias**

Replace the `resolve.alias` object:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@nexkan/shared': path.resolve(__dirname, '../shared/src'),
  },
},
```

- [ ] **Step 4: Update frontend/src/lib/api.ts — imports**

Change line 1 from:
```typescript
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '../types/task';
```
To:
```typescript
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@nexkan/shared';
```

- [ ] **Step 5: Update frontend/src/hooks/useTasks.ts — imports**

Change line 3 from:
```typescript
import { TaskFilters } from '../types/task';
```
To:
```typescript
import { TaskFilters } from '@nexkan/shared';
```

- [ ] **Step 6: Update frontend/src/hooks/useTaskMutation.ts — imports**

Change line 3 from:
```typescript
import { CreateTaskInput, UpdateTaskInput } from '../types/task';
```
To:
```typescript
import { CreateTaskInput, UpdateTaskInput } from '@nexkan/shared';
```

- [ ] **Step 7: Update frontend/src/pages/BoardPage.tsx — imports**

Change the line:
```typescript
import { Task, TaskFilters, TaskStatus } from '@/types/task';
```
To:
```typescript
import { Task, TaskFilters, TaskStatus } from '@nexkan/shared';
```

- [ ] **Step 8: Update frontend/src/pages/DashboardPage.tsx — imports**

Change the line:
```typescript
import { parseLocalDate, formatDate } from '@/lib/date';
```
To:
```typescript
import { parseLocalDate, formatDate } from '@nexkan/shared';
```

- [ ] **Step 9: Update frontend/src/components/board/KanbanBoard.tsx — imports**

Change the line:
```typescript
import { Task, TaskStatus } from '@/types/task';
```
To:
```typescript
import { Task, TaskStatus } from '@nexkan/shared';
```

- [ ] **Step 10: Update frontend/src/components/board/KanbanColumn.tsx — imports**

Change the line:
```typescript
import { Task, TaskStatus } from '@/types/task';
```
To:
```typescript
import { Task, TaskStatus } from '@nexkan/shared';
```

- [ ] **Step 11: Update frontend/src/components/board/MobileColumnNav.tsx — imports**

Change the line:
```typescript
import { Task, TaskStatus } from '@/types/task';
```
To:
```typescript
import { Task, TaskStatus } from '@nexkan/shared';
```

- [ ] **Step 12: Update frontend/src/components/task/TaskCard.tsx — imports**

Replace lines 3–6:
```typescript
import { isAfter, startOfDay } from 'date-fns';
import { parseLocalDate, formatDate } from '@/lib/date';
import { GripVertical, Calendar } from 'lucide-react';
import { Task } from '@/types/task';
```
With:
```typescript
import { isAfter, startOfDay } from 'date-fns';
import { Task, parseLocalDate, formatDate } from '@nexkan/shared';
import { GripVertical, Calendar } from 'lucide-react';
```

Note: `isAfter`, `startOfDay`, and `parseLocalDate` are still needed here because the local `isOverdue` function (which uses them) is not replaced until Task 9. Leave that function intact for now.

- [ ] **Step 13: Update frontend/src/components/task/TaskDetail.tsx — imports**

Replace lines 1–2:
```typescript
import { Task } from '@/types/task';
import { formatDate } from '@/lib/date';
```
With:
```typescript
import { Task, formatDate } from '@nexkan/shared';
```

- [ ] **Step 14: Update frontend/src/components/task/TaskDialog.tsx — imports**

Change line 11 from:
```typescript
import { Task, TaskStatus, TaskPriority } from '@/types/task';
```
To:
```typescript
import { Task, TaskStatus, TaskPriority } from '@nexkan/shared';
```

- [ ] **Step 15: Update frontend/src/components/dashboard/DeadlineList.tsx — imports**

Replace lines 1–2:
```typescript
import { Task } from '@/types/task';
import { formatDate } from '@/lib/date';
```
With:
```typescript
import { Task, formatDate } from '@nexkan/shared';
```

- [ ] **Step 16: Update frontend/src/components/dashboard/OverdueList.tsx — imports**

Replace lines 1–2:
```typescript
import { Task } from '@/types/task';
import { formatDate } from '@/lib/date';
```
With:
```typescript
import { Task, formatDate } from '@nexkan/shared';
```

- [ ] **Step 17: Delete local frontend copies**

```bash
rm frontend/src/types/task.ts frontend/src/lib/date.ts
```

- [ ] **Step 18: Verify frontend builds**

```bash
cd /home/san/workspace/NexKan/frontend
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 19: Commit**

```bash
cd /home/san/workspace/NexKan
git add frontend/package.json frontend/tsconfig.app.json frontend/vite.config.ts
git add frontend/src/lib/api.ts frontend/src/hooks/useTasks.ts frontend/src/hooks/useTaskMutation.ts
git add frontend/src/pages/BoardPage.tsx frontend/src/pages/DashboardPage.tsx
git add frontend/src/components/board/KanbanBoard.tsx frontend/src/components/board/KanbanColumn.tsx
git add frontend/src/components/board/MobileColumnNav.tsx
git add frontend/src/components/task/TaskCard.tsx frontend/src/components/task/TaskDetail.tsx
git add frontend/src/components/task/TaskDialog.tsx
git add frontend/src/components/dashboard/DeadlineList.tsx frontend/src/components/dashboard/OverdueList.tsx
git rm frontend/src/types/task.ts frontend/src/lib/date.ts
git add package-lock.json
git commit -m "feat(frontend): wire @nexkan/shared types and utilities"
```

---

### Task 8: Use shared business rules in backend

**Files:**
- Modify: `backend/src/tasks/store.ts`
- Modify: `backend/src/telegram/commands/move.ts`

- [ ] **Step 1: Update store.ts — import shared rules**

In `backend/src/tasks/store.ts`, change line 5 from:
```typescript
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '@nexkan/shared';
```
To:
```typescript
import { Task, TaskStatus, TaskFilters, CreateTaskInput, UpdateTaskInput, parseLocalDate, requiresDueDate, isOverdue } from '@nexkan/shared';
```

Also remove `parseLocalDate` from the standalone import on line 7 (it's now in the combined import above). Delete the line:
```typescript
import { parseLocalDate } from '@nexkan/shared';
```

Remove `isBefore` from the date-fns import on line 6 (it will no longer be used after the overdue filter change):
```typescript
import { startOfDay, isEqual, addDays, format } from 'date-fns';
```

- [ ] **Step 2: store.ts — delete parseDateStr, use shared in filters**

Delete the entire `parseDateStr` function (lines 40–42):
```typescript
function parseDateStr(dateStr: string): Date {
  return startOfDay(parseLocalDate(dateStr));
}
```

In `applyFilters`, replace the overdue filter block:
```typescript
if (filters.overdue) {
  result = result.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    return isBefore(parseDateStr(t.due_date), todayD);
  });
}
```
With:
```typescript
if (filters.overdue) {
  result = result.filter(t => t.due_date !== undefined && isOverdue(t.due_date, t.status, todayD));
}
```

Replace the due_today filter block:
```typescript
if (filters.due_today) {
  result = result.filter(t => {
    if (!t.due_date) return false;
    return isEqual(parseDateStr(t.due_date), todayD);
  });
}
```
With:
```typescript
if (filters.due_today) {
  result = result.filter(t => t.due_date !== undefined && isEqual(startOfDay(parseLocalDate(t.due_date)), todayD));
}
```

Replace the due_tomorrow filter block:
```typescript
if (filters.due_tomorrow) {
  result = result.filter(t => {
    if (!t.due_date) return false;
    return isEqual(parseDateStr(t.due_date), tomorrowD);
  });
}
```
With:
```typescript
if (filters.due_tomorrow) {
  result = result.filter(t => t.due_date !== undefined && isEqual(startOfDay(parseLocalDate(t.due_date)), tomorrowD));
}
```

- [ ] **Step 3: store.ts — replace inline requiresDueDate in create()**

In the `create()` function, replace:
```typescript
const requiresDueDate = status === 'todo' || status === 'in-progress';
if (requiresDueDate && !input.due_date) {
  throw new Error(`due_date is required when creating a task with status ${status}`);
}
```
With:
```typescript
if (requiresDueDate(status) && !input.due_date) {
  throw new Error(`due_date is required when creating a task with status ${status}`);
}
```

- [ ] **Step 4: store.ts — replace inline requiresDueDate in updateStatus()**

In the `updateStatus()` function, replace:
```typescript
const requiresDueDate = status === 'todo' || status === 'in-progress';
const effectiveDueDate = due_date ?? task.due_date;
if (requiresDueDate && !effectiveDueDate) {
  throw new Error(`due_date is required when moving to ${status}`);
}
```
With:
```typescript
const effectiveDueDate = due_date ?? task.due_date;
if (requiresDueDate(status as TaskStatus) && !effectiveDueDate) {
  throw new Error(`due_date is required when moving to ${status}`);
}
```

Note: `status` parameter is typed as `string` (from HTTP body, zod-validated upstream) — the cast `as TaskStatus` is safe here.

- [ ] **Step 5: move.ts — use TASK_STATUSES and requiresDueDate**

In `backend/src/telegram/commands/move.ts`, change the import line from:
```typescript
import { TaskStatus } from '@nexkan/shared';
```
To:
```typescript
import { TaskStatus, TASK_STATUSES, requiresDueDate } from '@nexkan/shared';
```

Replace the `VALID_STATUSES` constant declaration:
```typescript
const VALID_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];
```
Delete this line entirely (TASK_STATUSES from shared replaces it).

Replace `VALID_STATUSES` references with `TASK_STATUSES`:
```typescript
// Replace:
if (!VALID_STATUSES.includes(status)) {
  await ctx.reply(`Invalid status. Use: ${VALID_STATUSES.join(', ')}`);

// With:
if (!TASK_STATUSES.includes(status)) {
  await ctx.reply(`Invalid status. Use: ${TASK_STATUSES.join(', ')}`);
```

Replace the inline due-date check:
```typescript
// Replace:
const requiresDueDate = status === 'todo' || status === 'in-progress';
if (requiresDueDate && !task.due_date) {

// With:
if (requiresDueDate(status) && !task.due_date) {
```

- [ ] **Step 6: Verify TypeScript and tests**

```bash
cd /home/san/workspace/NexKan/backend
npx tsc --noEmit && npm test
```

Expected: `Tests: 72 passed, 72 total`

- [ ] **Step 7: Commit**

```bash
cd /home/san/workspace/NexKan
git add backend/src/tasks/store.ts backend/src/telegram/commands/move.ts
git commit -m "refactor(backend): use shared requiresDueDate, isOverdue, TASK_STATUSES"
```

---

### Task 9: Use shared business rules in frontend

**Files:**
- Modify: `frontend/src/components/task/TaskCard.tsx`
- Modify: `frontend/src/components/task/TaskDialog.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/board/KanbanBoard.tsx`

- [ ] **Step 1: TaskCard.tsx — replace local isOverdue with shared**

In `frontend/src/components/task/TaskCard.tsx`:

Replace lines 3–4 (date-fns + date lib imports):
```typescript
import { isAfter, startOfDay } from 'date-fns';
import { Task, parseLocalDate, formatDate } from '@nexkan/shared';
```
With:
```typescript
import { Task, formatDate, isOverdue } from '@nexkan/shared';
```

Delete the local `isOverdue` function entirely (lines 16–19):
```typescript
function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done') return false;
  return isAfter(startOfDay(new Date()), startOfDay(parseLocalDate(task.due_date)));
}
```

Replace the `overdue` variable assignment from:
```typescript
const overdue = isOverdue(task);
```
To:
```typescript
const overdue = task.due_date ? isOverdue(task.due_date, task.status) : false;
```

- [ ] **Step 2: TaskDialog.tsx — replace inline requiresDueDate**

In `frontend/src/components/task/TaskDialog.tsx`, change the import on line 11 from:
```typescript
import { Task, TaskStatus, TaskPriority } from '@nexkan/shared';
```
To:
```typescript
import { Task, TaskStatus, TaskPriority, requiresDueDate } from '@nexkan/shared';
```

Replace lines 56–59:
```typescript
const requiresDueDate = status === 'todo' || status === 'in-progress';
if (requiresDueDate && !dueDate) {
  setError(`Due date is required for status "${status}"`);
  return;
}
```
With:
```typescript
if (requiresDueDate(status) && !dueDate) {
  setError(`Due date is required for status "${status}"`);
  return;
}
```

- [ ] **Step 3: DashboardPage.tsx — use shared isOverdue**

In `frontend/src/pages/DashboardPage.tsx`, change the import on line 10 from:
```typescript
import { parseLocalDate, formatDate } from '@nexkan/shared';
```
To:
```typescript
import { parseLocalDate, formatDate, isOverdue } from '@nexkan/shared';
```

Remove `isBefore` from the date-fns import on line 9:
```typescript
import { startOfDay, isEqual, addDays } from 'date-fns';
```

In the `useMemo`, replace only the `overdueTasks` filter line:
```typescript
overdueTasks:   tasks.filter(task => task.due_date && task.status !== 'done' && isBefore(startOfDay(parseLocalDate(task.due_date)), t)),
```
With:
```typescript
overdueTasks:   tasks.filter(task => task.due_date !== undefined && isOverdue(task.due_date, task.status, t)),
```

Leave `todayTasks` and `tomorrowTasks` lines unchanged (they use `isEqual` + `parseLocalDate`, which is still correct).

- [ ] **Step 4: KanbanBoard.tsx — use TASK_STATUSES**

In `frontend/src/components/board/KanbanBoard.tsx`, change the import from:
```typescript
import { Task, TaskStatus } from '@nexkan/shared';
```
To:
```typescript
import { Task, TaskStatus, TASK_STATUSES } from '@nexkan/shared';
```

Replace line 18:
```typescript
const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];
```
With:
```typescript
const STATUSES = TASK_STATUSES;
```

- [ ] **Step 5: Verify frontend builds**

```bash
cd /home/san/workspace/NexKan/frontend
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` — no TypeScript errors.

- [ ] **Step 6: Run backend tests**

```bash
cd /home/san/workspace/NexKan/backend && npm test
```

Expected: `Tests: 72 passed, 72 total`

- [ ] **Step 7: Commit**

```bash
cd /home/san/workspace/NexKan
git add frontend/src/components/task/TaskCard.tsx
git add frontend/src/components/task/TaskDialog.tsx
git add frontend/src/pages/DashboardPage.tsx
git add frontend/src/components/board/KanbanBoard.tsx
git commit -m "refactor(frontend): use shared isOverdue, requiresDueDate, TASK_STATUSES"
```

---

### Task 10: Update Docker build

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Update docker-compose.yml backend build section**

Replace:
```yaml
backend:
  container_name: nexkan-backend
  build: ./backend
```
With:
```yaml
backend:
  container_name: nexkan-backend
  build:
    context: .
    dockerfile: backend/Dockerfile
```

(Keep all other backend service keys: `expose`, `volumes`, `env_file`, `restart` — unchanged.)

- [ ] **Step 2: Replace backend/Dockerfile**

Full replacement of `/home/san/workspace/NexKan/backend/Dockerfile`:

```dockerfile
# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

# Workspace manifests first — separate layer for npm install cache
COPY package.json        ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
# Frontend manifest needed for workspace resolution (source not copied)
COPY frontend/package.json ./frontend/

# Install workspace deps — creates node_modules/@nexkan/shared symlink
RUN npm install --workspace=@nexkan/shared --workspace=nexkan-backend

# Build shared (TypeScript composite project → shared/dist/)
COPY shared/src           ./shared/src
COPY shared/tsconfig.json ./shared/
RUN cd shared && npx tsc

# Build backend
COPY backend/src           ./backend/src
COPY backend/tsconfig.json ./backend/
RUN cd backend && npx tsc

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests + lockfile for reproducible prod install
COPY package.json          ./
COPY package-lock.json     ./
COPY shared/package.json   ./shared/
COPY backend/package.json  ./backend/
COPY frontend/package.json ./frontend/

# Fresh prod-only install — creates @nexkan/shared symlink pointing to /app/shared
RUN npm ci --workspace=@nexkan/shared --workspace=nexkan-backend --omit=dev

# Compiled output from builder
COPY --from=builder /app/shared/dist     ./shared/dist
COPY --from=builder /app/backend/dist    ./backend/dist
COPY --from=builder /app/backend/scripts ./backend/scripts

RUN chmod +x backend/scripts/init-data.sh

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "./scripts/init-data.sh && node dist/server.js"]
```

- [ ] **Step 3: Build Docker image**

```bash
cd /home/san/workspace/NexKan
docker build -f backend/Dockerfile -t nexkan-backend:test .
```

Expected: build completes with no errors. Final image size should be roughly similar to before.

- [ ] **Step 4: Smoke-test the image**

```bash
docker run --rm nexkan-backend:test node -e "
  const s = require('./dist/server.js');
" 2>&1 | head -3
```

Expected: process starts (may show port binding or error about missing data dir — that's fine; the important thing is `dist/server.js` loads without module-not-found errors).

- [ ] **Step 5: Commit**

```bash
cd /home/san/workspace/NexKan
git add docker-compose.yml backend/Dockerfile
git commit -m "feat(docker): widen build context to repo root for @nexkan/shared"
```

---

### Task 11: Final verification

- [ ] **Step 1: Confirm no remaining local-only type/date imports**

```bash
grep -rn "from '../types/task'\|from '../../types/task'\|from '@/types/task'\|from '../lib/date'\|from '../../lib/date'\|from '@/lib/date'" \
  /home/san/workspace/NexKan/backend/src \
  /home/san/workspace/NexKan/frontend/src
```

Expected: no output. Any hit means a file was missed — fix before continuing.

- [ ] **Step 2: Confirm no local TaskStatus/Task definitions remain**

```bash
grep -rn "^export type TaskStatus\|^export interface Task\b" \
  /home/san/workspace/NexKan/backend/src \
  /home/san/workspace/NexKan/frontend/src
```

Expected: no output. All definitions live in `shared/src/types/task.ts`.

- [ ] **Step 3: Full backend check**

```bash
cd /home/san/workspace/NexKan/backend
npx tsc --noEmit && npm test
```

Expected: TypeScript: no errors. `Tests: 72 passed, 72 total`

- [ ] **Step 4: Full frontend build**

```bash
cd /home/san/workspace/NexKan/frontend
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` — no errors.

- [ ] **Step 5: Final commit (if any unstaged changes remain)**

```bash
cd /home/san/workspace/NexKan
git status
```

If everything was committed in earlier tasks, skip. Otherwise:
```bash
git add -A && git commit -m "chore: shared package migration complete"
```
