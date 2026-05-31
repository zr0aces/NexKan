# Backend Tasks API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Express + TypeScript REST API for task CRUD with markdown file storage, Zod validation, tests, and Docker deployment.

**Architecture:** Express app with feature-module structure. Task data stored as individual markdown files with YAML frontmatter in `backend/data/tasks/`. Stateless — reads from disk on every request, no in-memory cache. Store reads `DATA_DIR` env var lazily (per-call) so tests can override it.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, gray-matter, nanoid@3, date-fns, zod, Jest + ts-jest + supertest

---

### Task 1: Project Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/.env.example`
- Create: `.gitignore`
- Create: directories `backend/src/tasks/`, `backend/src/types/`, `backend/tests/tasks/`, `backend/scripts/`, `backend/data/tasks/`

- [ ] **Step 1: Create root .gitignore**

```
node_modules/
dist/
backend/data/tasks/
backend/data/notifications-sent.json
.env
*.env.local
```

- [ ] **Step 2: Create backend/package.json**

```json
{
  "name": "nexkan-backend",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest"
  },
  "dependencies": {
    "date-fns": "^3.6.0",
    "express": "^4.19.2",
    "gray-matter": "^4.0.3",
    "nanoid": "3.3.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.2"
  }
}
```

- [ ] **Step 3: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create backend/jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
};
```

- [ ] **Step 5: Create backend/.env.example**

```bash
# Server
PORT=3000
NODE_ENV=development
TZ=UTC

# Data paths
DATA_DIR=/app/data/tasks
NOTIFICATIONS_FILE=/app/data/notifications-sent.json

# Telegram (Plan 2)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram
CRON_SECRET=

```

- [ ] **Step 6: Create directory structure and install dependencies**

```bash
mkdir -p backend/src/tasks backend/src/types backend/tests/tasks backend/scripts backend/data/tasks
cd backend && npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 7: Verify TypeScript compiles (empty src)**

```bash
# Create empty placeholder so tsc has something to check
echo 'export {};' > backend/src/types/task.ts
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add .gitignore backend/package.json backend/tsconfig.json backend/jest.config.js backend/.env.example backend/src/types/task.ts
git commit -m "chore: scaffold backend project (Express + TS + Jest)"
```

---

### Task 2: Task Type Definitions

**Files:**
- Modify: `backend/src/types/task.ts`

- [ ] **Step 1: Write type definitions**

Replace the placeholder `backend/src/types/task.ts`:

```typescript
export type TaskStatus = 'plan' | 'todo' | 'in-progress' | 'done';
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
  status?: TaskStatus;          // defaults to 'plan'
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

- [ ] **Step 2: Verify types compile**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/task.ts
git commit -m "feat: add Task type definitions"
```

---

### Task 3: Parser Module (TDD)

**Files:**
- Create: `backend/tests/tasks/parser.test.ts`
- Create: `backend/src/tasks/parser.ts`

The parser converts between markdown file content (gray-matter frontmatter + body) and `Task` objects. It is a pure module — no file I/O.

Body format:
```
## Description

<description text>

## Notes

<notes text>
```

- [ ] **Step 1: Write the failing parser tests**

Create `backend/tests/tasks/parser.test.ts`:

```typescript
import { parseTask, serializeTask } from '../../src/tasks/parser';
import { Task } from '../../src/types/task';

const SAMPLE_MD = `---
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
telegram_message_id: 98765
attachments:
  - receipts/jan2024.pdf
---

## Description

Buy milk, eggs, bread from the market.

## Notes

Check discount aisle for olive oil.
`;

describe('parseTask', () => {
  it('parses all frontmatter fields', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.id).toBe('a3f9k2mw');
    expect(task.title).toBe('Buy groceries');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('high');
    expect(task.tags).toEqual(['shopping', 'personal']);
    expect(task.due_date).toBe('2026-06-01');
    expect(task.sort_order).toBe(3);
    expect(task.created_at).toBe('2026-05-15T10:30:00Z');
    expect(task.updated_at).toBe('2026-05-16T08:00:00Z');
    expect(task.telegram_message_id).toBe(98765);
    expect(task.attachments).toEqual(['receipts/jan2024.pdf']);
  });

  it('parses description from body', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.description).toBe('Buy milk, eggs, bread from the market.');
  });

  it('parses notes from body', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.notes).toBe('Check discount aisle for olive oil.');
  });

  it('defaults optional arrays to empty', () => {
    const minimalMd = `---
id: x1y2z3w4
title: Minimal task
status: plan
sort_order: 1
created_at: "2026-05-01T00:00:00Z"
updated_at: "2026-05-01T00:00:00Z"
---

## Description

Just a task.
`;
    const task = parseTask(minimalMd, 'x1y2z3w4-minimal-task.md');
    expect(task.tags).toEqual([]);
    expect(task.attachments).toEqual([]);
    expect(task.notes).toBeUndefined();
    expect(task.priority).toBeUndefined();
  });
});

describe('serializeTask', () => {
  it('round-trips a task through serialize → parse', () => {
    const original = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    const serialized = serializeTask(original);
    const reparsed = parseTask(serialized, 'a3f9k2mw-buy-groceries.md');
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.title).toBe(original.title);
    expect(reparsed.status).toBe(original.status);
    expect(reparsed.tags).toEqual(original.tags);
    expect(reparsed.due_date).toBe(original.due_date);
    expect(reparsed.description).toBe(original.description);
    expect(reparsed.notes).toBe(original.notes);
  });

  it('omits undefined optional fields from frontmatter', () => {
    const minimalMd = `---
id: x1y2z3w4
title: Minimal task
status: plan
sort_order: 1
created_at: "2026-05-01T00:00:00Z"
updated_at: "2026-05-01T00:00:00Z"
---

## Description

Just a task.
`;
    const task = parseTask(minimalMd, 'x1y2z3w4-minimal-task.md');
    const serialized = serializeTask(task);
    expect(serialized).not.toContain('priority:');
    expect(serialized).not.toContain('due_date:');
    expect(serialized).not.toContain('notes:');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/tasks/parser.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../../src/tasks/parser'"

- [ ] **Step 3: Implement parser.ts**

Create `backend/src/tasks/parser.ts`:

```typescript
import matter from 'gray-matter';
import { Task } from '../types/task';

export function parseTask(content: string, filename: string): Task {
  const { data, content: body } = matter(content);

  return {
    id: data.id,
    title: data.title,
    status: data.status,
    priority: data.priority,
    tags: data.tags ?? [],
    due_date: data.due_date ? String(data.due_date) : undefined,
    sort_order: data.sort_order ?? 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
    telegram_message_id: data.telegram_message_id,
    attachments: data.attachments ?? [],
    description: extractSection(body, 'Description'),
    notes: extractSection(body, 'Notes') || undefined,
  };
}

export function serializeTask(task: Task): string {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    sort_order: task.sort_order,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };

  if (task.priority !== undefined) frontmatter.priority = task.priority;
  if (task.tags.length > 0) frontmatter.tags = task.tags;
  if (task.due_date !== undefined) frontmatter.due_date = task.due_date;
  if (task.telegram_message_id !== undefined) frontmatter.telegram_message_id = task.telegram_message_id;
  if (task.attachments.length > 0) frontmatter.attachments = task.attachments;

  let body = `\n## Description\n\n${task.description}\n`;
  if (task.notes) {
    body += `\n## Notes\n\n${task.notes}\n`;
  }

  return matter.stringify(body, frontmatter);
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/tasks/parser.test.ts --no-coverage
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/parser.ts backend/tests/tasks/parser.test.ts
git commit -m "feat: add task parser (markdown ↔ Task object)"
```

---

### Task 4: Store — Read Operations (TDD)

**Files:**
- Create: `backend/tests/tasks/store.test.ts`
- Create: `backend/src/tasks/store.ts`

The store reads `DATA_DIR` env var on every call so tests can override it with a temp directory.

- [ ] **Step 1: Write failing read tests**

Create `backend/tests/tasks/store.test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readAll, readById } from '../../src/tasks/store';
import { serializeTask } from '../../src/tasks/parser';
import { Task } from '../../src/types/task';

let tmpDir: string;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345',
    title: 'Test Task',
    status: 'todo',
    tags: [],
    sort_order: 1,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    attachments: [],
    description: 'A test task.',
    ...overrides,
  };
}

function writeTask(task: Task): void {
  const slug = task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const filename = `${task.id}-${slug}.md`;
  fs.writeFileSync(path.join(tmpDir, filename), serializeTask(task));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-test-'));
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readAll', () => {
  it('returns empty array when no tasks', async () => {
    const tasks = await readAll();
    expect(tasks).toEqual([]);
  });

  it('returns all tasks sorted by sort_order ascending', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', sort_order: 2 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', sort_order: 1 }));
    const tasks = await readAll();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('bbb22222');
    expect(tasks[1].id).toBe('aaa11111');
  });

  it('filters by status', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', status: 'todo' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', status: 'done', due_date: undefined }));
    const tasks = await readAll({ status: 'todo' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('aaa11111');
  });

  it('filters by tags (OR logic)', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', tags: ['work', 'urgent'] }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', tags: ['personal'] }));
    writeTask(makeTask({ id: 'ccc33333', title: 'Task C', tags: ['other'] }));
    const tasks = await readAll({ tags: 'work,personal' });
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.id)).toEqual(expect.arrayContaining(['aaa11111', 'bbb22222']));
  });

  it('filters by priority', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', priority: 'high' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', priority: 'low' }));
    const tasks = await readAll({ priority: 'high' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('aaa11111');
  });

  it('filters overdue tasks', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Past Task', status: 'todo', due_date: '2020-01-01' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Future Task', status: 'todo', due_date: '2099-12-31' }));
    writeTask(makeTask({ id: 'ccc33333', title: 'Done Task', status: 'done', due_date: '2020-01-01' }));
    const tasks = await readAll({ overdue: true });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('aaa11111');
  });

  it('searches title', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Buy groceries' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Deploy backend' }));
    const tasks = await readAll({ search: 'groceries' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('aaa11111');
  });

  it('searches tags', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', tags: ['shopping'] }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', tags: ['work'] }));
    const tasks = await readAll({ search: 'shopping' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('aaa11111');
  });
});

describe('readById', () => {
  it('finds task by ID prefix in filename', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'My Task' }));
    const task = await readById('abc12345');
    expect(task).not.toBeNull();
    expect(task!.id).toBe('abc12345');
    expect(task!.title).toBe('My Task');
  });

  it('returns null when task not found', async () => {
    const task = await readById('notexist');
    expect(task).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/tasks/store.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../../src/tasks/store'"

- [ ] **Step 3: Implement store read operations**

Create `backend/src/tasks/store.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseTask, serializeTask } from './parser';
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { startOfDay, parseISO, isBefore, isEqual, addDays, format } from 'date-fns';

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data', 'tasks');
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
}

async function readAllFiles(): Promise<Task[]> {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
    return parseTask(content, filename);
  });
}

function today(): Date {
  return startOfDay(new Date());
}

function parseDate(dateStr: string): Date {
  return startOfDay(parseISO(dateStr));
}

function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks;
  const todayDate = today();
  const tomorrowDate = addDays(todayDate, 1);

  if (filters.status) {
    const statuses = filters.status.split(',').map(s => s.trim());
    result = result.filter(t => statuses.includes(t.status));
  }

  if (filters.priority) {
    result = result.filter(t => t.priority === filters.priority);
  }

  if (filters.tags) {
    const tagList = filters.tags.split(',').map(s => s.trim());
    result = result.filter(t => tagList.some(tag => t.tags.includes(tag)));
  }

  if (filters.overdue) {
    result = result.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return isBefore(parseDate(t.due_date), todayDate);
    });
  }

  if (filters.due_today) {
    result = result.filter(t => {
      if (!t.due_date) return false;
      return isEqual(parseDate(t.due_date), todayDate);
    });
  }

  if (filters.due_tomorrow) {
    result = result.filter(t => {
      if (!t.due_date) return false;
      return isEqual(parseDate(t.due_date), tomorrowDate);
    });
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }

  return result;
}

function applySorting(tasks: Task[], sort?: string): Task[] {
  const sorted = [...tasks];
  switch (sort) {
    case 'due_date:desc':
      return sorted.sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''));
    case 'priority:desc': {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return sorted.sort((a, b) => (order[a.priority ?? 'low'] ?? 2) - (order[b.priority ?? 'low'] ?? 2));
    }
    case 'created_at:desc':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'due_date:asc':
      return sorted.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    case 'sort_order:asc':
    default:
      return sorted.sort((a, b) => a.sort_order - b.sort_order);
  }
}

export async function readAll(filters: TaskFilters = {}): Promise<Task[]> {
  const tasks = await readAllFiles();
  const filtered = applyFilters(tasks, filters);
  return applySorting(filtered, filters.sort);
}

export async function readById(id: string): Promise<Task | null> {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (files.length === 0) return null;
  const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
  return parseTask(content, files[0]);
}
```

- [ ] **Step 4: Run read tests to verify they pass**

```bash
cd backend && npx jest tests/tasks/store.test.ts --no-coverage
```

Expected: All `readAll` and `readById` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tasks/store.ts backend/tests/tasks/store.test.ts
git commit -m "feat: add task store read operations (readAll + readById)"
```

---

### Task 5: Store — Write Operations (TDD)

**Files:**
- Modify: `backend/tests/tasks/store.test.ts` (append write tests)
- Modify: `backend/src/tasks/store.ts` (add create/update/updateStatus/updateOrder/delete)

- [ ] **Step 1: Append write tests to store.test.ts**

Add after the existing tests in `backend/tests/tasks/store.test.ts`:

```typescript
import { create, update, updateStatus, updateOrder, deleteTask } from '../../src/tasks/store';

describe('create', () => {
  it('creates a file with generated ID and correct frontmatter', async () => {
    const task = await create({ title: 'New Task', description: 'Do it.' });
    expect(task.id).toHaveLength(8);
    expect(task.title).toBe('New Task');
    expect(task.status).toBe('plan');
    expect(task.sort_order).toBe(1);
    expect(task.created_at).toBeTruthy();
    expect(task.updated_at).toBeTruthy();

    // Verify file exists on disk
    const files = fs.readdirSync(tmpDir);
    expect(files.some(f => f.startsWith(task.id))).toBe(true);
  });

  it('assigns sort_order = max + 1 in column', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Existing', status: 'plan', sort_order: 5 }));
    const task = await create({ title: 'New Task', status: 'plan', description: 'x' });
    expect(task.sort_order).toBe(6);
  });

  it('accepts explicit status', async () => {
    const task = await create({ title: 'My Task', status: 'todo', due_date: '2026-12-31', description: 'x' });
    expect(task.status).toBe('todo');
  });
});

describe('update', () => {
  it('updates specified fields without touching others', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Original', tags: ['a'], sort_order: 2 }));
    const updated = await update('abc12345', { title: 'Updated' });
    expect(updated.title).toBe('Updated');
    expect(updated.tags).toEqual(['a']);
    expect(updated.sort_order).toBe(2);
  });

  it('updates updated_at timestamp', async () => {
    const before = new Date().toISOString();
    writeTask(makeTask({ id: 'abc12345', title: 'Task', updated_at: '2020-01-01T00:00:00Z' }));
    const updated = await update('abc12345', { title: 'New' });
    expect(updated.updated_at >= before).toBe(true);
  });

  it('throws NotFoundError when task does not exist', async () => {
    await expect(update('notexist', { title: 'x' })).rejects.toThrow('not found');
  });
});

describe('updateStatus', () => {
  it('changes status and resets sort_order to bottom of target column', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'A', status: 'in-progress', sort_order: 3 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'B', status: 'done', sort_order: 2 }));
    const updated = await updateStatus('aaa11111', 'done');
    expect(updated.status).toBe('done');
    expect(updated.sort_order).toBe(3); // max(done.sort_order=2) + 1 = 3
  });

  it('throws if moving to todo without due_date', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'plan', due_date: undefined }));
    await expect(updateStatus('abc12345', 'todo')).rejects.toThrow('due_date');
  });

  it('accepts due_date when moving to todo', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'plan', due_date: undefined }));
    const updated = await updateStatus('abc12345', 'todo', '2026-12-31');
    expect(updated.status).toBe('todo');
    expect(updated.due_date).toBe('2026-12-31');
  });
});

describe('updateOrder', () => {
  it('renumbers sort_order for all tasks in column', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'A', status: 'todo', sort_order: 1 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'B', status: 'todo', sort_order: 2 }));
    writeTask(makeTask({ id: 'ccc33333', title: 'C', status: 'todo', sort_order: 3 }));
    // Move C to position 0 (first)
    await updateOrder('ccc33333', 0);
    const tasks = await readAll({ status: 'todo' });
    expect(tasks[0].id).toBe('ccc33333');
    expect(tasks[1].id).toBe('aaa11111');
    expect(tasks[2].id).toBe('bbb22222');
  });
});

describe('deleteTask', () => {
  it('removes the task file', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'To Delete' }));
    await deleteTask('abc12345');
    const task = await readById('abc12345');
    expect(task).toBeNull();
  });

  it('throws NotFoundError when task does not exist', async () => {
    await expect(deleteTask('notexist')).rejects.toThrow('not found');
  });
});
```

Also add the import at the top of the existing test file (after the existing imports):

```typescript
import { create, update, updateStatus, updateOrder, deleteTask } from '../../src/tasks/store';
```

- [ ] **Step 2: Run tests to verify write tests fail**

```bash
cd backend && npx jest tests/tasks/store.test.ts --no-coverage
```

Expected: FAIL — `create`, `update`, `updateStatus`, `updateOrder`, `deleteTask` not exported.

- [ ] **Step 3: Implement write operations in store.ts**

Append to `backend/src/tasks/store.ts` (after the existing read exports):

```typescript
import { nanoid } from 'nanoid';

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Task ${id} not found`);
    this.name = 'NotFoundError';
  }
}

async function findFilePath(id: string): Promise<string> {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) throw new NotFoundError(id);
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (files.length === 0) throw new NotFoundError(id);
  return path.join(dir, files[0]);
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });

  const id = nanoid(8);
  const status = input.status ?? 'plan';
  const now = new Date().toISOString();

  // Compute sort_order: max in column + 1
  const allTasks = await readAllFiles();
  const inColumn = allTasks.filter(t => t.status === status);
  const sortOrder = inColumn.length > 0 ? Math.max(...inColumn.map(t => t.sort_order)) + 1 : 1;

  const task: Task = {
    id,
    title: input.title,
    status,
    tags: input.tags ?? [],
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    attachments: [],
    description: input.description ?? '',
    priority: input.priority,
    due_date: input.due_date,
    notes: input.notes,
  };

  const slug = toSlug(input.title);
  const filename = `${id}-${slug}.md`;
  fs.writeFileSync(path.join(dir, filename), serializeTask(task));
  return task;
}

export async function update(id: string, input: UpdateTaskInput): Promise<Task> {
  const filePath = await findFilePath(id);
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = parseTask(content, path.basename(filePath));

  const updated: Task = {
    ...task,
    ...Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined)
    ) as Partial<Task>,
    updated_at: new Date().toISOString(),
  };

  // Handle null due_date (clear it)
  if (input.due_date === null) {
    updated.due_date = undefined;
  }

  fs.writeFileSync(filePath, serializeTask(updated));
  return updated;
}

export async function updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
  const filePath = await findFilePath(id);
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = parseTask(content, path.basename(filePath));

  const requiresDueDate = status === 'todo' || status === 'in-progress';
  const effectiveDueDate = due_date ?? task.due_date;
  if (requiresDueDate && !effectiveDueDate) {
    throw new Error(`due_date is required when moving to ${status}`);
  }

  const allTasks = await readAllFiles();
  const inTargetColumn = allTasks.filter(t => t.status === status && t.id !== id);
  const sortOrder = inTargetColumn.length > 0
    ? Math.max(...inTargetColumn.map(t => t.sort_order)) + 1
    : 1;

  const updated: Task = {
    ...task,
    status: status as Task['status'],
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
    due_date: due_date ?? task.due_date,
  };

  fs.writeFileSync(filePath, serializeTask(updated));
  return updated;
}

export async function updateOrder(id: string, position: number): Promise<Task> {
  const task = await readById(id);
  if (!task) throw new NotFoundError(id);

  const allTasks = await readAllFiles();
  const inColumn = allTasks
    .filter(t => t.status === task.status)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Remove the moved task, insert at desired position
  const others = inColumn.filter(t => t.id !== id);
  others.splice(position, 0, task);

  // Renumber sort_order for all in column
  for (let i = 0; i < others.length; i++) {
    const t = others[i];
    const fp = await findFilePath(t.id);
    const content = fs.readFileSync(fp, 'utf-8');
    const parsed = parseTask(content, path.basename(fp));
    parsed.sort_order = i + 1;
    parsed.updated_at = new Date().toISOString();
    fs.writeFileSync(fp, serializeTask(parsed));
  }

  return (await readById(id))!;
}

export async function deleteTask(id: string): Promise<void> {
  const filePath = await findFilePath(id);
  fs.unlinkSync(filePath);
}
```

- [ ] **Step 4: Add nanoid import to store.ts (at top, with other imports)**

The `import { nanoid } from 'nanoid';` goes at the top of `store.ts` with the other imports.

- [ ] **Step 5: Run all store tests**

```bash
cd backend && npx jest tests/tasks/store.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/store.ts backend/tests/tasks/store.test.ts
git commit -m "feat: add task store write operations (create/update/updateStatus/updateOrder/delete)"
```

---

### Task 6: Task Router — Read Endpoints (TDD)

**Files:**
- Create: `backend/src/tasks/router.ts`
- Create: `backend/src/app.ts`
- Create: `backend/tests/tasks/router.test.ts`

- [ ] **Step 1: Create app.ts so supertest can import it**

Create `backend/src/app.ts`:

```typescript
import express from 'express';
import { taskRouter } from './tasks/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);

export default app;
```

- [ ] **Step 2: Write failing read endpoint tests**

Create `backend/tests/tasks/router.test.ts`:

```typescript
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { serializeTask } from '../../src/tasks/parser';
import { Task } from '../../src/types/task';

let tmpDir: string;
let app: typeof import('../../src/app').default;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345',
    title: 'Test Task',
    status: 'todo',
    tags: [],
    sort_order: 1,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    attachments: [],
    description: 'A test task.',
    due_date: '2099-12-31',
    ...overrides,
  };
}

function writeTask(task: Task): void {
  const slug = task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const filename = `${task.id}-${slug}.md`;
  fs.writeFileSync(path.join(tmpDir, filename), serializeTask(task));
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-router-test-'));
  process.env.DATA_DIR = tmpDir;
  // Dynamic require after setting env var
  app = (await import('../../src/app')).default;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  // Clear files between tests
  fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
});

describe('GET /api/tasks', () => {
  it('returns 200 with empty array', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns tasks sorted by sort_order', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', sort_order: 2 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', sort_order: 1 }));
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('bbb22222');
    expect(res.body[1].id).toBe('aaa11111');
  });

  it('filters by ?status=', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Todo Task', status: 'todo' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Done Task', status: 'done', due_date: undefined }));
    const res = await request(app).get('/api/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('aaa11111');
  });

  it('filters by ?search=', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Buy milk' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Deploy server' }));
    const res = await request(app).get('/api/tasks?search=milk');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('aaa11111');
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns 200 with task', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'My Task' }));
    const res = await request(app).get('/api/tasks/abc12345');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc12345');
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).get('/api/tasks/notexist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && npx jest tests/tasks/router.test.ts --no-coverage
```

Expected: FAIL — router.ts does not exist.

- [ ] **Step 4: Implement router read endpoints**

Create `backend/src/tasks/router.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { readAll, readById } from './store';
import { TaskFilters } from '../types/task';

export const taskRouter = Router();

taskRouter.get('/', async (req: Request, res: Response) => {
  try {
    const filters: TaskFilters = {
      status: req.query.status as string | undefined,
      tags: req.query.tags as string | undefined,
      priority: req.query.priority as string | undefined,
      search: req.query.search as string | undefined,
      sort: req.query.sort as string | undefined,
      overdue: req.query.overdue === 'true',
      due_today: req.query.due_today === 'true',
      due_tomorrow: req.query.due_tomorrow === 'true',
    };
    const tasks = await readAll(filters);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await readById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 5: Run read endpoint tests to verify they pass**

```bash
cd backend && npx jest tests/tasks/router.test.ts --no-coverage
```

Expected: All GET tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/router.ts backend/src/app.ts backend/tests/tasks/router.test.ts
git commit -m "feat: add task router read endpoints (GET /api/tasks + GET /api/tasks/:id)"
```

---

### Task 7: Task Router — Write Endpoints (TDD)

**Files:**
- Modify: `backend/tests/tasks/router.test.ts` (append write endpoint tests)
- Modify: `backend/src/tasks/router.ts` (add POST/PUT/PATCH/DELETE)

- [ ] **Step 1: Append write endpoint tests to router.test.ts**

Add after the existing tests in `backend/tests/tasks/router.test.ts`:

```typescript
describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'New Task', description: 'Do it.' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('New Task');
    expect(res.body.status).toBe('plan');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/tasks').send({ description: 'No title' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tasks/:id', () => {
  it('updates a task and returns 200', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Original' }));
    const res = await request(app)
      .put('/api/tasks/abc12345')
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app).put('/api/tasks/notexist').send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  it('moves task to new status', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'plan' }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'todo', due_date: '2099-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('todo');
  });

  it('returns 400 when moving to todo without due_date', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'plan', due_date: undefined }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'todo' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task' }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app)
      .patch('/api/tasks/notexist/status')
      .send({ status: 'done' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id/order', () => {
  it('reorders task within column and returns 200', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'A', status: 'todo', sort_order: 1 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'B', status: 'todo', sort_order: 2 }));
    writeTask(makeTask({ id: 'abc12345', title: 'C', status: 'todo', sort_order: 3 }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/order')
      .send({ position: 0 });
    expect(res.status).toBe(200);
    expect(res.body.sort_order).toBe(1);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'To Delete' }));
    const res = await request(app).delete('/api/tasks/abc12345');
    expect(res.status).toBe(204);
    const check = await request(app).get('/api/tasks/abc12345');
    expect(check.status).toBe(404);
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app).delete('/api/tasks/notexist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify write tests fail**

```bash
cd backend && npx jest tests/tasks/router.test.ts --no-coverage
```

Expected: FAIL — POST/PUT/PATCH/DELETE return 404 (routes not defined).

- [ ] **Step 3: Install zod and add Zod schemas + write routes**

Zod is already in package.json. Add write routes to `backend/src/tasks/router.ts`:

```typescript
import { z } from 'zod';
import { create, update, updateStatus, updateOrder, deleteTask, NotFoundError } from './store';
import { TaskStatus } from '../types/task';

const VALID_STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['plan', 'todo', 'in-progress', 'done']).optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
});

const StatusSchema = z.object({
  status: z.enum(['plan', 'todo', 'in-progress', 'done']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const OrderSchema = z.object({
  position: z.number().int().min(0),
});

taskRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await create(parsed.data);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.put('/:id', async (req: Request, res: Response) => {
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await update(req.params.id, parsed.data);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await updateStatus(req.params.id, parsed.data.status, parsed.data.due_date);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    if (err instanceof Error && err.message.includes('due_date')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.patch('/:id/order', async (req: Request, res: Response) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await updateOrder(req.params.id, parsed.data.position);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteTask(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Run all router tests**

```bash
cd backend && npx jest tests/tasks/router.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/router.ts backend/tests/tasks/router.test.ts
git commit -m "feat: add task router write endpoints (POST/PUT/PATCH/DELETE)"
```

---

### Task 8: Server Entry Point + Init Script

**Files:**
- Create: `backend/src/server.ts`
- Create: `backend/scripts/init-data.sh`

- [ ] **Step 1: Create server.ts**

Create `backend/src/server.ts`:

```typescript
import app from './app';

const port = parseInt(process.env.PORT ?? '3000', 10);

app.listen(port, () => {
  console.log(`NexKan backend running on port ${port}`);
});
```

- [ ] **Step 2: Create init-data.sh**

Create `backend/scripts/init-data.sh`:

```bash
#!/bin/bash
set -e

DATA_DIR="${DATA_DIR:-./data/tasks}"
NOTIFICATIONS_FILE="${NOTIFICATIONS_FILE:-./data/notifications-sent.json}"

mkdir -p "$DATA_DIR"
mkdir -p "$(dirname "$NOTIFICATIONS_FILE")"

if [ ! -f "$NOTIFICATIONS_FILE" ]; then
  echo '{}' > "$NOTIFICATIONS_FILE"
  echo "Created $NOTIFICATIONS_FILE"
fi

echo "Data directories ready."
```

```bash
chmod +x backend/scripts/init-data.sh
```

- [ ] **Step 3: Verify server starts**

```bash
cd backend && DATA_DIR=/tmp/nexkan-dev npx ts-node-dev --transpile-only src/server.ts &
sleep 3
curl -s http://localhost:3000/api/tasks | grep '\[\]' && echo "Server OK"
kill %1
```

Expected: `[]` returned, "Server OK" printed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts backend/scripts/init-data.sh
git commit -m "feat: add server entry point and data init script"
```

---

### Task 9: Docker + Nginx Infrastructure

**Files:**
- Create: `backend/Dockerfile`
- Create: `nginx/Dockerfile`
- Create: `nginx/nexkan.conf`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
RUN chmod +x scripts/init-data.sh
EXPOSE 3000
CMD ["sh", "-c", "./scripts/init-data.sh && node dist/server.js"]
```

- [ ] **Step 2: Create nginx/Dockerfile**

```dockerfile
FROM nginx:1.27-alpine
COPY nexkan.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 3: Create nginx/nexkan.conf**

```nginx
server {
    listen 80;
    server_name _;

    # Telegram webhook — no auth, secret validated by backend middleware
    location /api/webhooks/telegram {
        auth_basic off;
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
    }

    # Cron notification trigger — no auth, X-Cron-Secret validated by backend middleware
    location /api/notifications/check {
        auth_basic off;
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Cron-Secret $http_x_cron_secret;
    }

    # All other API routes — basic auth
    location /api/ {
        auth_basic "NexKan";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend static files — basic auth
    location / {
        auth_basic "NexKan";
        auth_basic_user_file /etc/nginx/.htpasswd;
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
services:
  backend:
    build: ./backend
    expose:
      - "3000"
    volumes:
      - ./data/tasks:/app/data/tasks
      - ./data/notifications-sent.json:/app/data/notifications-sent.json
    env_file: .env
    restart: unless-stopped

  nginx:
    build: ./nginx
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/.htpasswd:/etc/nginx/.htpasswd:ro
    depends_on:
      - backend
    restart: unless-stopped
```

- [ ] **Step 5: Create root .env (from .env.example) and data directories**

```bash
cp backend/.env.example .env
mkdir -p data/tasks
echo '{}' > data/notifications-sent.json
# Create a placeholder htpasswd (admin:admin — for dev only, change in production)
printf 'admin:$apr1$xyz$xxxxxxxxxxxxxxxxxxxxxxxxxxxx\n' > nginx/.htpasswd
# Actually generate a real one:
docker run --rm httpd:alpine htpasswd -nb admin password > nginx/.htpasswd
```

- [ ] **Step 6: Build and start containers**

```bash
# Build frontend placeholder so nginx doesn't fail
mkdir -p frontend/dist
echo '<html><body>NexKan</body></html>' > frontend/dist/index.html

docker compose up --build -d
```

Wait 10 seconds for containers to start.

- [ ] **Step 7: Verify backend API is reachable through nginx**

```bash
curl -u admin:password http://localhost/api/tasks
```

Expected: `[]` returned.

- [ ] **Step 8: Verify containers are healthy**

```bash
docker compose ps
```

Expected: Both `backend` and `nginx` show state `Up`.

- [ ] **Step 9: Stop containers**

```bash
docker compose down
```

- [ ] **Step 10: Commit**

```bash
git add backend/Dockerfile nginx/ docker-compose.yml
git commit -m "feat: add Docker and nginx infrastructure"
```

---

## Plan Complete

After Task 9:
- REST API fully functional with markdown storage
- All tests passing
- Docker deployment verified

**Next plans:**
- `2026-05-31-plan2-telegram.md` — Telegram bot + commands + notifications
- `2026-05-31-plan4-frontend.md` — React Kanban frontend
