# Scratchpad (Sticky Notes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scratchpad feature — independent freeform sticky notes with Telegram bot support and one-click conversion to Kanban tasks.

**Architecture:** New dedicated `scratchpad` module in backend (parser + store + router) mirrors the existing `tasks` module. Frontend adds a `ScratchpadPanel` component rendered below the Kanban board on both pages. Shared `Note` type lives in `@nexkan/shared`.

**Tech Stack:** TypeScript, gray-matter (already used by tasks), nanoid, Express + Zod, TanStack Query, React, Tailwind/shadcn-ui, grammy (Telegram)

---

## File Map

**Create:**
- `shared/src/types/note.ts` — `Note` interface
- `backend/src/scratchpad/parser.ts` — serialize/deserialize note markdown
- `backend/src/scratchpad/store.ts` — CRUD over `data/scratchpad/`
- `backend/src/scratchpad/router.ts` — REST endpoints `/api/notes`
- `backend/src/telegram/commands/note.ts` — `/note` command
- `backend/src/telegram/commands/notes.ts` — `/notes` command
- `backend/src/telegram/commands/delnote.ts` — `/delnote` command
- `backend/tests/scratchpad/parser.test.ts`
- `backend/tests/scratchpad/store.test.ts`
- `backend/tests/scratchpad/router.test.ts`
- `backend/tests/telegram/scratchpad-commands.test.ts`
- `frontend/src/hooks/useNotes.ts`
- `frontend/src/hooks/useNoteMutation.ts`
- `frontend/src/components/scratchpad/NoteCard.tsx`
- `frontend/src/components/scratchpad/ConvertDialog.tsx`
- `frontend/src/components/scratchpad/ScratchpadPanel.tsx`

**Modify:**
- `shared/src/index.ts` — export `Note`
- `backend/src/app.ts` — mount `noteRouter` at `/api/notes`
- `backend/src/telegram/router.ts` — register `/note`, `/notes`, `/delnote` commands in `setupBotCommands()`
- `backend/src/telegram/commands/help.ts` — add scratchpad commands to help text
- `frontend/src/lib/api.ts` — add `api.notes.*` methods
- `frontend/src/pages/BoardPage.tsx` — render `<ScratchpadPanel />`
- `frontend/src/pages/DashboardPage.tsx` — render `<ScratchpadPanel />`
- `.env.example` — document `SCRATCHPAD_DIR`

---

## Task 1: Add `Note` type to shared package

**Files:**
- Create: `shared/src/types/note.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Create the Note type**

Create `shared/src/types/note.ts`:

```ts
export interface Note {
  id: string;
  content: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

- [ ] **Step 2: Export from shared index**

Add one line to `shared/src/index.ts`:

```ts
export * from './types/task';
export * from './types/note';   // add this line
export * from './lib/date';
export * from './lib/task';
```

- [ ] **Step 3: Rebuild shared**

```bash
cd shared && npm run build
```

Expected: no TypeScript errors, `shared/dist/` updated.

- [ ] **Step 4: Commit**

```bash
git add shared/src/types/note.ts shared/src/index.ts shared/dist/
git commit -m "feat(shared): add Note type for scratchpad"
```

---

## Task 2: Scratchpad parser

**Files:**
- Create: `backend/src/scratchpad/parser.ts`
- Create: `backend/tests/scratchpad/parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scratchpad/parser.test.ts`:

```ts
import { parseNote, serializeNote } from '../../src/scratchpad/parser';

const SAMPLE_MD = `---
id: abc12345
created_at: "2026-06-01T10:00:00.000Z"
updated_at: "2026-06-01T10:05:00.000Z"
---

Buy milk and call dentist
`;

describe('parseNote', () => {
  it('parses id from frontmatter', () => {
    expect(parseNote(SAMPLE_MD).id).toBe('abc12345');
  });

  it('parses timestamps from frontmatter', () => {
    const note = parseNote(SAMPLE_MD);
    expect(note.created_at).toBe('2026-06-01T10:00:00.000Z');
    expect(note.updated_at).toBe('2026-06-01T10:05:00.000Z');
  });

  it('parses body as trimmed content', () => {
    expect(parseNote(SAMPLE_MD).content).toBe('Buy milk and call dentist');
  });
});

describe('serializeNote', () => {
  it('round-trips: serialize then parse preserves all fields', () => {
    const original = parseNote(SAMPLE_MD);
    const reparsed = parseNote(serializeNote(original));
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.content).toBe(original.content);
    expect(reparsed.created_at).toBe(original.created_at);
    expect(reparsed.updated_at).toBe(original.updated_at);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/scratchpad/parser.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/scratchpad/parser'`

- [ ] **Step 3: Implement the parser**

Create `backend/src/scratchpad/parser.ts`:

```ts
import matter from 'gray-matter';
import { Note } from '@nexkan/shared';

export function parseNote(fileContent: string): Note {
  const { data, content } = matter(fileContent);
  return {
    id: data.id,
    content: content.trim(),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export function serializeNote(note: Note): string {
  return matter.stringify(`\n${note.content}\n`, {
    id: note.id,
    created_at: note.created_at,
    updated_at: note.updated_at,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/scratchpad/parser.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/scratchpad/parser.ts backend/tests/scratchpad/parser.test.ts
git commit -m "feat(scratchpad): add note parser"
```

---

## Task 3: Scratchpad store

**Files:**
- Create: `backend/src/scratchpad/store.ts`
- Create: `backend/tests/scratchpad/store.test.ts`

The store uses `process.env.SCRATCHPAD_DIR` (defaults to `<cwd>/data/scratchpad`). Tests set this to a temp dir, same pattern as the task store tests.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scratchpad/store.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readAll, readById, create, update, deleteNote, NotFoundError } from '../../src/scratchpad/store';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-scratchpad-test-'));
  process.env.SCRATCHPAD_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.SCRATCHPAD_DIR;
});

describe('readAll', () => {
  it('returns empty array when dir is empty', async () => {
    expect(await readAll()).toEqual([]);
  });

  it('returns notes sorted by created_at desc', async () => {
    const n1 = await create('First note');
    await new Promise(r => setTimeout(r, 5));
    const n2 = await create('Second note');
    const notes = await readAll();
    expect(notes[0].id).toBe(n2.id);
    expect(notes[1].id).toBe(n1.id);
  });
});

describe('readById', () => {
  it('returns note by id', async () => {
    const created = await create('Hello');
    const found = await readById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.content).toBe('Hello');
  });

  it('returns null for unknown id', async () => {
    expect(await readById('notexist')).toBeNull();
  });
});

describe('create', () => {
  it('creates a note with given content', async () => {
    const note = await create('Buy milk');
    expect(note.content).toBe('Buy milk');
    expect(note.id).toHaveLength(8);
    expect(note.created_at).toBeTruthy();
    expect(note.updated_at).toBeTruthy();
  });

  it('persists note as a markdown file', async () => {
    const note = await create('Test content');
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files).toContain(`${note.id}.md`);
  });
});

describe('update', () => {
  it('updates note content', async () => {
    const note = await create('Original');
    const updated = await update(note.id, 'Updated');
    expect(updated.content).toBe('Updated');
    expect(updated.id).toBe(note.id);
    expect(updated.created_at).toBe(note.created_at);
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(update('notexist', 'x')).rejects.toThrow(NotFoundError);
  });
});

describe('deleteNote', () => {
  it('removes the markdown file', async () => {
    const note = await create('To delete');
    await deleteNote(note.id);
    expect(fs.existsSync(path.join(tmpDir, `${note.id}.md`))).toBe(false);
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(deleteNote('notexist')).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/scratchpad/store.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/scratchpad/store'`

- [ ] **Step 3: Implement the store**

Create `backend/src/scratchpad/store.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { parseNote, serializeNote } from './parser';
import { Note } from '@nexkan/shared';

function getDir(): string {
  return process.env.SCRATCHPAD_DIR ?? path.join(process.cwd(), 'data', 'scratchpad');
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Note ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export async function readAll(): Promise<Note[]> {
  const dir = getDir();
  try {
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md'));
    const notes = await Promise.all(
      files.map(f => fs.promises.readFile(path.join(dir, f), 'utf-8').then(parseNote))
    );
    return notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readById(id: string): Promise<Note | null> {
  try {
    const content = await fs.promises.readFile(path.join(getDir(), `${id}.md`), 'utf-8');
    return parseNote(content);
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function create(content: string): Promise<Note> {
  const dir = getDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const id = nanoid(8);
  const now = new Date().toISOString();
  const note: Note = { id, content, created_at: now, updated_at: now };
  await fs.promises.writeFile(path.join(dir, `${id}.md`), serializeNote(note));
  return note;
}

export async function update(id: string, content: string): Promise<Note> {
  const existing = await readById(id);
  if (!existing) throw new NotFoundError(id);
  const updated: Note = { ...existing, content, updated_at: new Date().toISOString() };
  await fs.promises.writeFile(path.join(getDir(), `${id}.md`), serializeNote(updated));
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await fs.promises.unlink(path.join(getDir(), `${id}.md`));
  } catch (err: any) {
    if (err.code === 'ENOENT') throw new NotFoundError(id);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/scratchpad/store.test.ts --no-coverage
```

Expected: PASS (all 9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/scratchpad/store.ts backend/tests/scratchpad/store.test.ts
git commit -m "feat(scratchpad): add note store"
```

---

## Task 4: Scratchpad REST router

**Files:**
- Create: `backend/src/scratchpad/router.ts`
- Create: `backend/tests/scratchpad/router.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/scratchpad/router.test.ts`:

```ts
import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tmpDir: string;
let app: typeof import('../../src/app').default;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-note-router-test-'));
  process.env.SCRATCHPAD_DIR = tmpDir;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-task-router-test-'));
  app = (await import('../../src/app')).default;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

afterEach(() => {
  fs.readdirSync(tmpDir).filter(f => f.endsWith('.md')).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
});

describe('GET /api/notes', () => {
  it('returns 200 with empty array when no notes', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns notes after creation', async () => {
    await request(app).post('/api/notes').send({ content: 'Hello' });
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Hello');
  });
});

describe('POST /api/notes', () => {
  it('creates a note and returns 201', async () => {
    const res = await request(app).post('/api/notes').send({ content: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Buy milk');
    expect(res.body.id).toHaveLength(8);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/api/notes').send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('updates note content and returns 200', async () => {
    const created = (await request(app).post('/api/notes').send({ content: 'Original' })).body;
    const res = await request(app).patch(`/api/notes/${created.id}`).send({ content: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/notes/notexist').send({ content: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('deletes note and returns 204', async () => {
    const created = (await request(app).post('/api/notes').send({ content: 'To delete' })).body;
    const res = await request(app).delete(`/api/notes/${created.id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/notes/notexist');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/notes/:id/convert', () => {
  it('converts note to task and returns 201 task', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'Buy milk\nFrom the market' })).body;
    const res = await request(app)
      .post(`/api/notes/${note.id}/convert`)
      .send({ due_date: '2099-12-31', priority: 'low' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Buy milk');
    expect(res.body.description).toBe('From the market');
    expect(res.body.status).toBe('todo');
  });

  it('deletes the note after conversion', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'Single line' })).body;
    await request(app).post(`/api/notes/${note.id}/convert`).send({ due_date: '2099-12-31' });
    const notesRes = await request(app).get('/api/notes');
    expect(notesRes.body).toHaveLength(0);
  });

  it('returns 404 for unknown note id', async () => {
    const res = await request(app).post('/api/notes/notexist/convert').send({ due_date: '2099-12-31' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when due_date is missing and status requires it', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'No date' })).body;
    const res = await request(app).post(`/api/notes/${note.id}/convert`).send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/scratchpad/router.test.ts --no-coverage
```

Expected: FAIL — routes not found (404) since router doesn't exist yet.

- [ ] **Step 3: Implement the router**

Create `backend/src/scratchpad/router.ts`:

```ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { readAll, readById, create, update, deleteNote, NotFoundError } from './store';
import { create as createTask } from '../tasks/store';

const ContentSchema = z.object({ content: z.string().min(1) });

const ConvertSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
});

export const noteRouter = Router();

noteRouter.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await readAll());
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.post('/', async (req: Request, res: Response) => {
  const parsed = ContentSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await create(parsed.data.content));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = ContentSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(await update(req.params.id, parsed.data.content));
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteNote(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.post('/:id/convert', async (req: Request, res: Response) => {
  const parsed = ConvertSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const note = await readById(req.params.id);
    if (!note) return void res.status(404).json({ error: `Note ${req.params.id} not found` });

    const lines = note.content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(1).join('\n').trim() || undefined;

    const task = await createTask({
      title,
      description,
      due_date: parsed.data.due_date,
      priority: parsed.data.priority,
      status: parsed.data.status ?? 'todo',
    });
    await deleteNote(req.params.id);
    res.status(201).json(task);
  } catch (err) {
    if (err instanceof Error && err.message.includes('due_date')) {
      return void res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Mount the router in `backend/src/app.ts`**

Replace the current content of `backend/src/app.ts`:

```ts
import express from 'express';
import { taskRouter } from './tasks/router';
import { noteRouter } from './scratchpad/router';
import { telegramRouter } from './telegram/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);
app.use('/api/notes', noteRouter);
app.use('/api', telegramRouter);

export default app;
```

- [ ] **Step 5: Add `SCRATCHPAD_DIR` to `.env.example`**

Add after the `DATA_DIR` line in `.env.example`:

```
DATA_DIR=/app/data/tasks
SCRATCHPAD_DIR=/app/data/scratchpad
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npx jest tests/scratchpad/router.test.ts --no-coverage
```

Expected: PASS (all 8 tests)

- [ ] **Step 7: Run the full test suite to check for regressions**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/scratchpad/router.ts backend/src/app.ts backend/tests/scratchpad/router.test.ts .env.example
git commit -m "feat(scratchpad): add REST router and mount at /api/notes"
```

---

## Task 5: Telegram scratchpad commands

**Files:**
- Create: `backend/src/telegram/commands/note.ts`
- Create: `backend/src/telegram/commands/notes.ts`
- Create: `backend/src/telegram/commands/delnote.ts`
- Create: `backend/tests/telegram/scratchpad-commands.test.ts`
- Modify: `backend/src/telegram/router.ts`
- Modify: `backend/src/telegram/commands/help.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/telegram/scratchpad-commands.test.ts`:

```ts
jest.mock('../../src/scratchpad/store', () => ({
  create: jest.fn(),
  readAll: jest.fn(),
  deleteNote: jest.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor(id: string) { super(`Note ${id} not found`); this.name = 'NotFoundError'; }
  },
}));

import { create, readAll, deleteNote, NotFoundError } from '../../src/scratchpad/store';
import { handleNote } from '../../src/telegram/commands/note';
import { handleNotes } from '../../src/telegram/commands/notes';
import { handleDelnote } from '../../src/telegram/commands/delnote';
import { Note } from '@nexkan/shared';

function makeCtx(match: string = ''): any {
  return { match, reply: jest.fn().mockResolvedValue({}) };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'abc12345',
    content: 'Test note content',
    created_at: '2026-06-01T10:00:00.000Z',
    updated_at: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('handleNote', () => {
  it('creates a note with given text', async () => {
    (create as jest.Mock).mockResolvedValue(makeNote({ content: 'Buy milk' }));
    const ctx = makeCtx('Buy milk');
    await handleNote(ctx);
    expect(create).toHaveBeenCalledWith('Buy milk');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('abc12345'));
  });

  it('replies with usage when text is empty', async () => {
    const ctx = makeCtx('');
    await handleNote(ctx);
    expect(create).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});

describe('handleNotes', () => {
  it('replies with numbered list when notes exist', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeNote({ id: 'aaa11111', content: 'First note' }),
      makeNote({ id: 'bbb22222', content: 'Second note' }),
    ]);
    const ctx = makeCtx();
    await handleNotes(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('aaa11111'),
      expect.any(Object)
    );
  });

  it('replies with no-notes message when list is empty', async () => {
    (readAll as jest.Mock).mockResolvedValue([]);
    const ctx = makeCtx();
    await handleNotes(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('No'));
  });
});

describe('handleDelnote', () => {
  it('deletes note by id and confirms', async () => {
    (deleteNote as jest.Mock).mockResolvedValue(undefined);
    const ctx = makeCtx('abc12345');
    await handleDelnote(ctx);
    expect(deleteNote).toHaveBeenCalledWith('abc12345');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('deleted'));
  });

  it('replies with not-found when id does not exist', async () => {
    (deleteNote as jest.Mock).mockRejectedValue(new NotFoundError('notexist'));
    const ctx = makeCtx('notexist');
    await handleDelnote(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('replies with usage when id is empty', async () => {
    const ctx = makeCtx('');
    await handleDelnote(ctx);
    expect(deleteNote).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/telegram/scratchpad-commands.test.ts --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `note.ts` command**

Create `backend/src/telegram/commands/note.ts`:

```ts
import { create } from '../../scratchpad/store';

export async function handleNote(ctx: any): Promise<void> {
  const text: string = ctx.match?.trim() ?? '';
  if (!text) {
    await ctx.reply('Usage: /note <text>\nExample: /note Call dentist Monday');
    return;
  }
  try {
    const note = await create(text);
    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
    await ctx.reply(`📝 Note saved (${note.id}): ${preview}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 4: Create `notes.ts` command**

Create `backend/src/telegram/commands/notes.ts`:

```ts
import { readAll } from '../../scratchpad/store';
import { escapeMd } from '../utils';

export async function handleNotes(ctx: any): Promise<void> {
  try {
    const notes = await readAll();
    if (notes.length === 0) {
      await ctx.reply('No scratchpad notes.');
      return;
    }
    const lines = notes.map((n, i) => {
      const preview = n.content.length > 60 ? n.content.slice(0, 57) + '...' : n.content;
      return `${i + 1}. (${n.id}) ${escapeMd(preview)}`;
    });
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 5: Create `delnote.ts` command**

Create `backend/src/telegram/commands/delnote.ts`:

```ts
import { deleteNote, NotFoundError } from '../../scratchpad/store';

export async function handleDelnote(ctx: any): Promise<void> {
  const id: string = ctx.match?.trim() ?? '';
  if (!id) {
    await ctx.reply('Usage: /delnote <id>\nExample: /delnote abc12345');
    return;
  }
  try {
    await deleteNote(id);
    await ctx.reply(`🗑 Note ${id} deleted.`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await ctx.reply(`Note ${id} not found.`);
      return;
    }
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 6: Register commands in `backend/src/telegram/router.ts`**

Add imports at the top of `backend/src/telegram/router.ts` (after existing imports):

```ts
import { handleNote } from './commands/note';
import { handleNotes } from './commands/notes';
import { handleDelnote } from './commands/delnote';
```

Add three lines inside `setupBotCommands()` (after the existing `bot.command('help', handleHelp)` line):

```ts
  bot.command('note', handleNote);
  bot.command('notes', handleNotes);
  bot.command('delnote', handleDelnote);
```

- [ ] **Step 7: Update help text in `backend/src/telegram/commands/help.ts`**

Replace the full file content:

```ts
export async function handleHelp(ctx: any): Promise<void> {
  try {
    await ctx.reply(
      `NexKan Commands:\n\n` +
      `/add <title> [date] — Create task (accepts: "tomorrow", "next monday", "2026-06-01")\n` +
      `/tasks — List all non-done tasks\n` +
      `/today — Tasks due today\n` +
      `/overdue — Overdue tasks\n` +
      `/task <id> — Task detail + actions\n` +
      `/move <id> <status> — Move task (todo|in-progress|done)\n\n` +
      `Scratchpad:\n` +
      `/note <text> — Save a quick note\n` +
      `/notes — List all notes\n` +
      `/delnote <id> — Delete a note by id`
    );
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd backend && npx jest tests/telegram/scratchpad-commands.test.ts --no-coverage
```

Expected: PASS (all 7 tests)

- [ ] **Step 9: Run the full test suite**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/telegram/commands/note.ts backend/src/telegram/commands/notes.ts backend/src/telegram/commands/delnote.ts backend/src/telegram/router.ts backend/src/telegram/commands/help.ts backend/tests/telegram/scratchpad-commands.test.ts
git commit -m "feat(telegram): add /note, /notes, /delnote commands"
```

---

## Task 6: Frontend API client and hooks

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useNotes.ts`
- Create: `frontend/src/hooks/useNoteMutation.ts`

- [ ] **Step 1: Add note API methods to `frontend/src/lib/api.ts`**

Add `Note` to the import at the top:

```ts
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, Note, TaskPriority, TaskStatus } from '@nexkan/shared';
```

Add the `notes` block inside the `api` object (after the `tasks` block, before the closing `}`):

```ts
  notes: {
    list(): Promise<Note[]> {
      return request<Note[]>('/notes');
    },

    create(content: string): Promise<Note> {
      return request<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },

    update(id: string, content: string): Promise<Note> {
      return request<Note>(`/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
    },

    delete(id: string): Promise<void> {
      return request<void>(`/notes/${id}`, { method: 'DELETE' });
    },

    convert(
      id: string,
      opts: { due_date?: string; priority?: TaskPriority; status?: TaskStatus }
    ): Promise<Task> {
      return request<Task>(`/notes/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(opts),
      });
    },
  },
```

- [ ] **Step 2: Create `frontend/src/hooks/useNotes.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: () => api.notes.list(),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Create `frontend/src/hooks/useNoteMutation.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TaskPriority, TaskStatus } from '@nexkan/shared';

function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['notes'] });
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (content: string) => api.notes.create(content),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.notes.update(id, content),
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => api.notes.delete(id),
    onSuccess: invalidate,
  });
}

export function useConvertNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      due_date,
      priority,
      status,
    }: {
      id: string;
      due_date?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
    }) => api.notes.convert(id, { due_date, priority, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useNotes.ts frontend/src/hooks/useNoteMutation.ts
git commit -m "feat(frontend): add notes API client and hooks"
```

---

## Task 7: NoteCard component

**Files:**
- Create: `frontend/src/components/scratchpad/NoteCard.tsx`

- [ ] **Step 1: Create `NoteCard.tsx`**

Create `frontend/src/components/scratchpad/NoteCard.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { Trash2, ArrowRightCircle } from 'lucide-react';
import { Note } from '@nexkan/shared';
import { Button } from '@/components/ui/button';

interface NoteCardProps {
  note: Note;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onConvert: (note: Note) => void;
}

export function NoteCard({ note, onUpdate, onDelete, onConvert }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(note.content);
  }, [note.content]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function handleBlur() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.content) {
      onUpdate(note.id, trimmed);
    }
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 w-52 flex-shrink-0 flex flex-col gap-2 shadow-sm">
      {editing ? (
        <textarea
          ref={textareaRef}
          className="w-full text-sm bg-transparent resize-none outline-none min-h-[80px]"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        <p
          className="text-sm whitespace-pre-wrap cursor-text min-h-[80px] break-words"
          onClick={() => setEditing(true)}
        >
          {note.content}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Convert to task"
          onClick={() => onConvert(note)}
        >
          <ArrowRightCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          title="Delete note"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scratchpad/NoteCard.tsx
git commit -m "feat(frontend): add NoteCard component"
```

---

## Task 8: ConvertDialog component

**Files:**
- Create: `frontend/src/components/scratchpad/ConvertDialog.tsx`

- [ ] **Step 1: Create `ConvertDialog.tsx`**

Create `frontend/src/components/scratchpad/ConvertDialog.tsx`:

```tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Note, TaskPriority } from '@nexkan/shared';

interface ConvertDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, due_date: string, priority?: TaskPriority) => void;
}

export function ConvertDialog({ note, open, onOpenChange, onConfirm }: ConvertDialogProps) {
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setDueDate('');
      setPriority('');
      setError('');
    }
  }, [open]);

  function handleConfirm() {
    if (!dueDate) {
      setError('Due date is required');
      return;
    }
    onConfirm(note!.id, dueDate, priority || undefined);
    onOpenChange(false);
  }

  const preview = note?.content.split('\n')[0] ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convert to Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Task title: <strong className="text-foreground break-all">{preview}</strong>
          </p>
          <p className="text-xs text-muted-foreground">Status will be set to <strong>todo</strong>.</p>
          <div className="space-y-1.5">
            <Label htmlFor="convert-due-date">Due Date *</Label>
            <Input
              id="convert-due-date"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convert-priority">Priority</Label>
            <select
              id="convert-priority"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority | '')}
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm}>Convert</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scratchpad/ConvertDialog.tsx
git commit -m "feat(frontend): add ConvertDialog component"
```

---

## Task 9: ScratchpadPanel and wire into pages

**Files:**
- Create: `frontend/src/components/scratchpad/ScratchpadPanel.tsx`
- Modify: `frontend/src/pages/BoardPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Create `ScratchpadPanel.tsx`**

Create `frontend/src/components/scratchpad/ScratchpadPanel.tsx`:

```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Note, TaskPriority } from '@nexkan/shared';
import { Button } from '@/components/ui/button';
import { NoteCard } from './NoteCard';
import { ConvertDialog } from './ConvertDialog';
import { useNotes } from '@/hooks/useNotes';
import { useCreateNote, useUpdateNote, useDeleteNote, useConvertNote } from '@/hooks/useNoteMutation';

export function ScratchpadPanel() {
  const { data: notes = [], isLoading } = useNotes();
  const [convertTarget, setConvertTarget] = useState<Note | null>(null);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const convertNote = useConvertNote();

  function handleAdd() {
    createNote.mutate('New note');
  }

  function handleUpdate(id: string, content: string) {
    updateNote.mutate({ id, content });
  }

  function handleDelete(id: string) {
    deleteNote.mutate(id);
  }

  function handleConvertConfirm(id: string, due_date: string, priority?: TaskPriority) {
    convertNote.mutate({ id, due_date, priority, status: 'todo' });
    setConvertTarget(null);
  }

  return (
    <div className="border-t pt-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Scratchpad
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={createNote.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      )}

      {!isLoading && notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      {notes.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onConvert={n => setConvertTarget(n)}
            />
          ))}
        </div>
      )}

      <ConvertDialog
        note={convertTarget}
        open={convertTarget !== null}
        onOpenChange={open => { if (!open) setConvertTarget(null); }}
        onConfirm={handleConvertConfirm}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `ScratchpadPanel` to `BoardPage.tsx`**

Add the import after the existing imports in `frontend/src/pages/BoardPage.tsx`:

```ts
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';
```

Add `<ScratchpadPanel />` inside `<main>`, after the `<KanbanBoard>` block (before the closing `</main>`). The `main` block currently ends with:

```tsx
        {!isLoading && !error && (
          <KanbanBoard
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onAddClick={handleAddClick}
          />
        )}
      </main>
```

Change it to:

```tsx
        {!isLoading && !error && (
          <KanbanBoard
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onAddClick={handleAddClick}
          />
        )}

        <ScratchpadPanel />
      </main>
```

- [ ] **Step 3: Add `ScratchpadPanel` to `DashboardPage.tsx`**

Add the import after the existing imports in `frontend/src/pages/DashboardPage.tsx`:

```ts
import { ScratchpadPanel } from '@/components/scratchpad/ScratchpadPanel';
```

Add `<ScratchpadPanel />` at the end of `<main>`, after the last closing `</>` (before `</main>`). The end of `main` currently is:

```tsx
        )}
      </main>
```

Change it to:

```tsx
        )}

        <ScratchpadPanel />
      </main>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Build the frontend**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Start backend and verify end-to-end**

```bash
cd backend && npm run dev
```

In a second terminal:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Verify:

1. Scratchpad panel visible below the Kanban board
2. "Add Note" button creates a new yellow sticky card
3. Clicking note text makes it editable; blur saves it
4. Delete button (trash) removes the card
5. Convert button (arrow) opens the ConvertDialog with due date + priority fields
6. Converting creates a task in the Board and removes the note card

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/scratchpad/ScratchpadPanel.tsx frontend/src/pages/BoardPage.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat(frontend): add ScratchpadPanel to Board and Dashboard pages"
```
