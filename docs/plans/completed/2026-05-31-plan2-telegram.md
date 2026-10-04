# Telegram Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Plan 1 (Backend Tasks API) must be complete. This plan adds the `telegram/` module inside the existing backend.

**Goal:** Add a Telegram bot to NexKan with task commands, inline buttons, and daily due-date notifications triggered by OS cron.

**Architecture:** `backend/src/telegram/` module added to the existing Express app. grammy handles bot setup and webhook. `notifier.ts` checks due dates and sends alerts. Webhook and cron endpoints added to nginx routing. Module imports `tasks/store.ts` directly — no HTTP between modules.

**Tech Stack:** grammy, chrono-node (already in plan 1 deps — add it), date-fns (already installed)

---

### Task 1: Add grammy + chrono-node Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd backend && npm install grammy chrono-node
npm install --save-dev @types/node
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add grammy and chrono-node dependencies"
```

---

### Task 2: Telegram Middleware (TDD)

**Files:**
- Create: `backend/src/telegram/middleware.ts`
- Create: `backend/tests/telegram/middleware.test.ts`

The middleware validates the `X-Telegram-Bot-Api-Secret-Token` header (webhookAuth) and `X-Cron-Secret` header (cronAuth). Returns 401 on mismatch, calls `next()` on success.

- [ ] **Step 1: Write failing middleware tests**

Create `backend/tests/telegram/middleware.test.ts`:

```typescript
import request from 'supertest';
import express from 'express';
import { webhookAuth, cronAuth } from '../../src/telegram/middleware';

function makeApp(middleware: ReturnType<typeof webhookAuth | typeof cronAuth>) {
  const app = express();
  app.use(middleware);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('webhookAuth', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
  });

  it('returns 401 when header is missing', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when header is wrong', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'wrong');
    expect(res.status).toBe(401);
  });

  it('calls next when header matches', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'test-secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('cronAuth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
  });

  it('returns 401 when header is missing', async () => {
    const app = makeApp(cronAuth);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('calls next when X-Cron-Secret matches', async () => {
    const app = makeApp(cronAuth);
    const res = await request(app).get('/test').set('X-Cron-Secret', 'cron-secret');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/telegram/middleware.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create directory and implement middleware**

```bash
mkdir -p backend/src/telegram/commands backend/tests/telegram
```

Create `backend/src/telegram/middleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (!secret || header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET;
  const header = req.headers['x-cron-secret'];
  if (!secret || header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest tests/telegram/middleware.test.ts --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/telegram/middleware.ts backend/tests/telegram/middleware.test.ts
git commit -m "feat: add Telegram webhook and cron auth middleware"
```

---

### Task 3: Bot Setup (bot.ts)

**Files:**
- Create: `backend/src/telegram/bot.ts`

Sets up grammy Bot instance and registers the webhook on startup. Exported as a singleton so all command files share the same instance.

- [ ] **Step 1: Create bot.ts**

Create `backend/src/telegram/bot.ts`:

```typescript
import { Bot } from 'grammy';

let bot: Bot | null = null;

export function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
    bot = new Bot(token);
  }
  return bot;
}

export async function registerWebhook(): Promise<void> {
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!url) {
    console.warn('TELEGRAM_WEBHOOK_URL not set — webhook not registered');
    return;
  }
  const b = getBot();
  await b.api.setWebhook(url, { secret_token: secret });
  console.log(`Telegram webhook registered: ${url}`);
}
```

- [ ] **Step 2: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/telegram/bot.ts
git commit -m "feat: add grammy bot singleton and webhook registration"
```

---

### Task 4: Telegram Commands (TDD)

**Files:**
- Create: `backend/src/telegram/commands/help.ts`
- Create: `backend/src/telegram/commands/add.ts`
- Create: `backend/src/telegram/commands/tasks.ts`
- Create: `backend/src/telegram/commands/today.ts`
- Create: `backend/src/telegram/commands/overdue.ts`
- Create: `backend/src/telegram/commands/task.ts`
- Create: `backend/src/telegram/commands/move.ts`
- Create: `backend/tests/telegram/commands.test.ts`

Commands are handler functions receiving a grammy `Context`. Tests mock `ctx.reply` and `ctx.replyWithMarkdown`, and mock `tasks/store` functions.

- [ ] **Step 1: Write command tests**

Create `backend/tests/telegram/commands.test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock store before importing commands
jest.mock('../../src/tasks/store', () => ({
  readAll: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  readById: jest.fn(),
}));

import { readAll, create, updateStatus, readById } from '../../src/tasks/store';
import { handleAdd } from '../../src/telegram/commands/add';
import { handleTasks } from '../../src/telegram/commands/tasks';
import { handleToday } from '../../src/telegram/commands/today';
import { handleOverdue } from '../../src/telegram/commands/overdue';
import { handleHelp } from '../../src/telegram/commands/help';
import { handleMove } from '../../src/telegram/commands/move';
import { handleTask } from '../../src/telegram/commands/task';
import { Task } from '../../src/types/task';

function makeCtx(text: string = ''): any {
  return {
    message: { text },
    match: text.split(' ').slice(1).join(' '),
    reply: jest.fn().mockResolvedValue({}),
    replyWithMarkdown: jest.fn().mockResolvedValue({}),
    callbackQuery: undefined,
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
  };
}

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleHelp', () => {
  it('replies with command reference', async () => {
    const ctx = makeCtx('/help');
    await handleHelp(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply.mock.calls[0][0]).toContain('/add');
    expect(ctx.reply.mock.calls[0][0]).toContain('/tasks');
  });
});

describe('handleAdd', () => {
  it('creates a task with title', async () => {
    (create as jest.Mock).mockResolvedValue(makeTask({ title: 'Buy milk' }));
    const ctx = makeCtx('/add Buy milk');
    ctx.match = 'Buy milk';
    await handleAdd(ctx);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Buy milk' }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('created'));
  });

  it('replies with error when title is empty', async () => {
    const ctx = makeCtx('/add');
    ctx.match = '';
    await handleAdd(ctx);
    expect(create).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('parses natural language date', async () => {
    (create as jest.Mock).mockResolvedValue(makeTask());
    const ctx = makeCtx('/add Deploy server tomorrow');
    ctx.match = 'Deploy server tomorrow';
    await handleAdd(ctx);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Deploy server',
        due_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
  });

  it('catches errors and replies with message', async () => {
    (create as jest.Mock).mockRejectedValue(new Error('Disk error'));
    const ctx = makeCtx('/add Task');
    ctx.match = 'Task';
    await handleAdd(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('Something went wrong. Try again.');
  });
});

describe('handleTasks', () => {
  it('shows grouped tasks', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'aaa11111', title: 'Todo Task', status: 'todo' }),
      makeTask({ id: 'bbb22222', title: 'Plan Task', status: 'plan', due_date: undefined }),
    ]);
    const ctx = makeCtx('/tasks');
    await handleTasks(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Todo Task'), expect.anything());
  });

  it('shows "No tasks" when empty', async () => {
    (readAll as jest.Mock).mockResolvedValue([]);
    const ctx = makeCtx('/tasks');
    await handleTasks(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('No tasks'));
  });
});

describe('handleToday', () => {
  it('shows tasks due today', async () => {
    (readAll as jest.Mock).mockResolvedValue([makeTask({ title: 'Due Today Task' })]);
    const ctx = makeCtx('/today');
    await handleToday(ctx);
    expect(readAll).toHaveBeenCalledWith(expect.objectContaining({ due_today: true }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Due Today Task'), expect.anything());
  });
});

describe('handleOverdue', () => {
  it('shows overdue tasks', async () => {
    (readAll as jest.Mock).mockResolvedValue([makeTask({ title: 'Overdue Task', due_date: '2020-01-01' })]);
    const ctx = makeCtx('/overdue');
    await handleOverdue(ctx);
    expect(readAll).toHaveBeenCalledWith(expect.objectContaining({ overdue: true }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Overdue Task'), expect.anything());
  });
});

describe('handleTask', () => {
  it('shows task detail with action buttons', async () => {
    (readById as jest.Mock).mockResolvedValue(makeTask({ id: 'abc12345', title: 'My Task' }));
    const ctx = makeCtx('/task abc12345');
    ctx.match = 'abc12345';
    await handleTask(ctx);
    expect(readById).toHaveBeenCalledWith('abc12345');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('My Task'),
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });

  it('replies not found for unknown ID', async () => {
    (readById as jest.Mock).mockResolvedValue(null);
    const ctx = makeCtx('/task notexist');
    ctx.match = 'notexist';
    await handleTask(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

describe('handleMove', () => {
  it('moves a task to new status', async () => {
    (readById as jest.Mock).mockResolvedValue(makeTask({ id: 'abc12345', due_date: '2099-12-31' }));
    (updateStatus as jest.Mock).mockResolvedValue(makeTask({ status: 'done' }));
    const ctx = makeCtx('/move abc12345 done');
    ctx.match = 'abc12345 done';
    await handleMove(ctx);
    expect(updateStatus).toHaveBeenCalledWith('abc12345', 'done', undefined);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('done'));
  });

  it('asks for due_date when moving to todo without one', async () => {
    (readById as jest.Mock).mockResolvedValue(makeTask({ id: 'abc12345', due_date: undefined, status: 'plan' }));
    const ctx = makeCtx('/move abc12345 todo');
    ctx.match = 'abc12345 todo';
    await handleMove(ctx);
    expect(updateStatus).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('due date'));
  });

  it('shows usage when args are wrong', async () => {
    const ctx = makeCtx('/move');
    ctx.match = '';
    await handleMove(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});

```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/telegram/commands.test.ts --no-coverage
```

Expected: FAIL — command modules not found.

- [ ] **Step 3: Implement help.ts**

Create `backend/src/telegram/commands/help.ts`:

```typescript
export async function handleHelp(ctx: any): Promise<void> {
  try {
    await ctx.reply(
      `NexKan Commands:\n\n` +
      `/add <title> [date] — Create task (accepts: "tomorrow", "next monday", "2026-06-01")\n` +
      `/tasks — List all non-done tasks\n` +
      `/today — Tasks due today\n` +
      `/overdue — Overdue tasks\n` +
      `/task <id> — Task detail + actions\n` +
      `/move <id> <status> — Move task (plan|todo|in-progress|done)`
    );
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 4: Implement add.ts**

Create `backend/src/telegram/commands/add.ts`:

```typescript
import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import { create } from '../../tasks/store';

export async function handleAdd(ctx: any): Promise<void> {
  try {
    const text: string = ctx.match?.trim() ?? '';
    if (!text) {
      await ctx.reply('Usage: /add <title> [date]\nExample: /add Buy milk tomorrow');
      return;
    }

    // Try to parse date from the end of the text
    const parsed = chrono.parse(text);
    let title = text;
    let due_date: string | undefined;

    if (parsed.length > 0) {
      const dateResult = parsed[parsed.length - 1];
      due_date = format(dateResult.date(), 'yyyy-MM-dd');
      // Remove the date part from the title
      title = text.slice(0, dateResult.index).trim() || text.slice(0, dateResult.index + dateResult.text.length).trim();
      if (!title) title = text;
    }

    const task = await create({ title, due_date, status: 'plan', description: '' });
    await ctx.reply(`✅ Task created: ${task.title} (${task.id})${due_date ? `\nDue: ${due_date}` : ''}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 5: Implement tasks.ts**

Create `backend/src/telegram/commands/tasks.ts`:

```typescript
import { readAll } from '../../tasks/store';
import { Task, TaskStatus } from '../../types/task';
import { InlineKeyboard } from 'grammy';

function formatTask(t: Task): string {
  const due = t.due_date ? ` · Due: ${t.due_date}` : '';
  const priority = t.priority ? ` [${t.priority}]` : '';
  return `• ${t.title} (${t.id})${priority}${due}`;
}

export async function handleTasks(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ status: 'plan,todo,in-progress' });
    if (tasks.length === 0) {
      await ctx.reply('No tasks found.');
      return;
    }

    const grouped: Record<string, Task[]> = { plan: [], todo: [], 'in-progress': [] };
    for (const t of tasks) {
      if (grouped[t.status]) grouped[t.status].push(t);
    }

    const lines: string[] = [];
    if (grouped.plan.length > 0) {
      lines.push('📋 Plan:');
      grouped.plan.forEach(t => lines.push(formatTask(t)));
    }
    if (grouped.todo.length > 0) {
      lines.push('\n📌 Todo:');
      grouped.todo.forEach(t => lines.push(formatTask(t)));
    }
    if (grouped['in-progress'].length > 0) {
      lines.push('\n🔄 In Progress:');
      grouped['in-progress'].forEach(t => lines.push(formatTask(t)));
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 6: Implement today.ts**

Create `backend/src/telegram/commands/today.ts`:

```typescript
import { readAll } from '../../tasks/store';
import { Task } from '../../types/task';

function formatTask(t: Task): string {
  const priority = t.priority ? ` [${t.priority}]` : '';
  const status = ` · ${t.status}`;
  return `• ${t.title} (${t.id})${priority}${status}`;
}

export async function handleToday(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ due_today: true });
    if (tasks.length === 0) {
      await ctx.reply('No tasks due today.', { parse_mode: 'Markdown' });
      return;
    }
    const lines = ['🔔 Due today:'];
    tasks.forEach(t => lines.push(formatTask(t)));
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 7: Implement overdue.ts**

Create `backend/src/telegram/commands/overdue.ts`:

```typescript
import { readAll } from '../../tasks/store';
import { Task } from '../../types/task';

function formatTask(t: Task): string {
  const due = t.due_date ? ` · Due: ${t.due_date}` : '';
  return `• ${t.title} (${t.id})${due}`;
}

export async function handleOverdue(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ overdue: true });
    if (tasks.length === 0) {
      await ctx.reply('No overdue tasks. 🎉', { parse_mode: 'Markdown' });
      return;
    }
    const lines = ['⚠️ Overdue tasks:'];
    tasks.forEach(t => lines.push(formatTask(t)));
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 8: Implement task.ts**

Create `backend/src/telegram/commands/task.ts`:

```typescript
import { readById } from '../../tasks/store';
import { InlineKeyboard } from 'grammy';

export async function handleTask(ctx: any): Promise<void> {
  try {
    const id: string = ctx.match?.trim() ?? '';
    if (!id) {
      await ctx.reply('Usage: /task <id>');
      return;
    }

    const task = await readById(id);
    if (!task) {
      await ctx.reply(`Task ${id} not found.`);
      return;
    }

    const lines = [
      `*${task.title}* (${task.id})`,
      `Status: ${task.status}`,
      task.due_date ? `Due: ${task.due_date}` : '',
      task.priority ? `Priority: ${task.priority}` : '',
      task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
      task.description ? `\n${task.description}` : '',
    ].filter(Boolean);

    const keyboard = new InlineKeyboard()
      .text('▶ Start', `move:${task.id}:in-progress`)
      .text('✅ Complete', `move:${task.id}:done`)
      .row()
      .text('📌 Todo', `move:${task.id}:todo`)
      .text('📋 Plan', `move:${task.id}:plan`);

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 9: Implement move.ts**

Create `backend/src/telegram/commands/move.ts`:

```typescript
import { readById, updateStatus } from '../../tasks/store';
import { TaskStatus } from '../../types/task';

const VALID_STATUSES: TaskStatus[] = ['plan', 'todo', 'in-progress', 'done'];

export async function handleMove(ctx: any): Promise<void> {
  try {
    const args: string = ctx.match?.trim() ?? '';
    const parts = args.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await ctx.reply('Usage: /move <id> <status>\nStatuses: plan, todo, in-progress, done');
      return;
    }

    const [id, rawStatus] = parts;
    const status = rawStatus.toLowerCase() as TaskStatus;

    if (!VALID_STATUSES.includes(status)) {
      await ctx.reply(`Invalid status. Use: ${VALID_STATUSES.join(', ')}`);
      return;
    }

    const task = await readById(id);
    if (!task) {
      await ctx.reply(`Task ${id} not found.`);
      return;
    }

    const requiresDueDate = status === 'todo' || status === 'in-progress';
    if (requiresDueDate && !task.due_date) {
      await ctx.reply(`Task "${task.title}" has no due date.\nPlease set one first:\n/add ${task.title} <date>\nOr move to plan/done instead.`);
      return;
    }

    await updateStatus(id, status);
    await ctx.reply(`✅ Moved "${task.title}" → ${status}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
```

- [ ] **Step 10: Run command tests**

```bash
cd backend && npx jest tests/telegram/commands.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/src/telegram/commands/ backend/tests/telegram/commands.test.ts
git commit -m "feat: add Telegram bot commands (add/tasks/today/overdue/task/move/help)"
```

---

### Task 5: Inline Button Callbacks (TDD)

**Files:**
- Create: `backend/src/telegram/callbacks.ts`
- Create: `backend/tests/telegram/callbacks.test.ts`

Handles `callback_data` in format `move:{taskId}:{newStatus}` and `view:{taskId}`.

- [ ] **Step 1: Write failing callback tests**

Create `backend/tests/telegram/callbacks.test.ts`:

```typescript
jest.mock('../../src/tasks/store', () => ({
  updateStatus: jest.fn(),
  readById: jest.fn(),
}));

import { updateStatus, readById } from '../../src/tasks/store';
import { handleCallback } from '../../src/telegram/callbacks';
import { Task } from '../../src/types/task';
import { InlineKeyboard } from 'grammy';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345', title: 'Test Task', status: 'todo', tags: [],
    sort_order: 1, created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z',
    attachments: [], description: 'x', due_date: '2099-12-31', ...overrides,
  };
}

function makeCtx(data: string): any {
  return {
    callbackQuery: { data },
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    reply: jest.fn().mockResolvedValue({}),
    editMessageText: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('handleCallback', () => {
  it('handles move:{id}:{status} — moves task', async () => {
    (updateStatus as jest.Mock).mockResolvedValue(makeTask({ status: 'done' }));
    const ctx = makeCtx('move:abc12345:done');
    await handleCallback(ctx);
    expect(updateStatus).toHaveBeenCalledWith('abc12345', 'done', undefined);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining('done') });
  });

  it('handles move to todo — asks for date when task has none', async () => {
    (updateStatus as jest.Mock).mockRejectedValue(new Error('due_date is required'));
    const ctx = makeCtx('move:abc12345:todo');
    await handleCallback(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining('due date') });
  });

  it('handles view:{id} — shows task detail', async () => {
    (readById as jest.Mock).mockResolvedValue(makeTask({ title: 'My Task' }));
    const ctx = makeCtx('view:abc12345');
    await handleCallback(ctx);
    expect(readById).toHaveBeenCalledWith('abc12345');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('My Task'),
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });

  it('ignores unknown callback data', async () => {
    const ctx = makeCtx('unknown:data');
    await handleCallback(ctx);
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/telegram/callbacks.test.ts --no-coverage
```

Expected: FAIL — callbacks module not found.

- [ ] **Step 3: Implement callbacks.ts**

Create `backend/src/telegram/callbacks.ts`:

```typescript
import { updateStatus, readById } from '../tasks/store';
import { InlineKeyboard } from 'grammy';
import { TaskStatus } from '../types/task';

export async function handleCallback(ctx: any): Promise<void> {
  const data: string = ctx.callbackQuery?.data ?? '';

  if (data.startsWith('move:')) {
    const [, taskId, newStatus] = data.split(':');
    try {
      const task = await updateStatus(taskId, newStatus);
      await ctx.answerCallbackQuery({ text: `✅ Moved to ${newStatus}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      const text = msg.includes('due_date')
        ? 'Please set a due date before moving to this status.'
        : 'Something went wrong.';
      await ctx.answerCallbackQuery({ text });
    }
    return;
  }

  if (data.startsWith('view:')) {
    const [, taskId] = data.split(':');
    try {
      const task = await readById(taskId);
      if (!task) {
        await ctx.answerCallbackQuery({ text: 'Task not found.' });
        return;
      }
      const lines = [
        `*${task.title}* (${task.id})`,
        `Status: ${task.status}`,
        task.due_date ? `Due: ${task.due_date}` : '',
        task.priority ? `Priority: ${task.priority}` : '',
      ].filter(Boolean);

      const keyboard = new InlineKeyboard()
        .text('▶ Start', `move:${task.id}:in-progress`)
        .text('✅ Complete', `move:${task.id}:done`)
        .row()
        .text('📌 Todo', `move:${task.id}:todo`)
        .text('📋 Plan', `move:${task.id}:plan`);

      await ctx.answerCallbackQuery();
      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.answerCallbackQuery({ text: 'Something went wrong.' });
    }
    return;
  }

  await ctx.answerCallbackQuery();
}
```

- [ ] **Step 4: Run callback tests**

```bash
cd backend && npx jest tests/telegram/callbacks.test.ts --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/telegram/callbacks.ts backend/tests/telegram/callbacks.test.ts
git commit -m "feat: add Telegram inline button callback handler"
```

---

### Task 6: Notifier (TDD)

**Files:**
- Create: `backend/src/telegram/notifier.ts`
- Create: `backend/tests/telegram/notifier.test.ts`

Reads all non-done tasks, checks due dates, sends Telegram alerts. Uses `data/notifications-sent.json` for deduplication.

- [ ] **Step 1: Write failing notifier tests**

Create `backend/tests/telegram/notifier.test.ts`:

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('../../src/tasks/store', () => ({
  readAll: jest.fn(),
}));

jest.mock('../../src/telegram/bot', () => ({
  getBot: jest.fn().mockReturnValue({
    api: {
      sendMessage: jest.fn().mockResolvedValue({}),
    },
  }),
}));

import { readAll } from '../../src/tasks/store';
import { checkAndNotify } from '../../src/telegram/notifier';
import { Task } from '../../src/types/task';

let tmpFile: string;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345', title: 'Test Task', status: 'todo', tags: [],
    sort_order: 1, created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z',
    attachments: [], description: 'x', ...overrides,
  };
}

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `nexkan-notif-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, '{}');
  process.env.NOTIFICATIONS_FILE = tmpFile;
  process.env.TELEGRAM_CHAT_ID = '123456';
  jest.clearAllMocks();
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('checkAndNotify', () => {
  it('sends overdue notification for task with past due_date', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', title: 'Old Task', due_date: '2020-01-01', status: 'todo' }),
    ]);
    const { getBot } = require('../../src/telegram/bot');
    await checkAndNotify();
    expect(getBot().api.sendMessage).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('Overdue'),
      expect.anything()
    );
  });

  it('does not send duplicate notifications', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', title: 'Old Task', due_date: '2020-01-01', status: 'todo' }),
    ]);
    const { getBot } = require('../../src/telegram/bot');
    await checkAndNotify();
    await checkAndNotify();
    // sendMessage called once (second run sees dedup key)
    expect(getBot().api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('skips done tasks', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', due_date: '2020-01-01', status: 'done' }),
    ]);
    const { getBot } = require('../../src/telegram/bot');
    await checkAndNotify();
    expect(getBot().api.sendMessage).not.toHaveBeenCalled();
  });

  it('skips tasks without due_date', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', due_date: undefined }),
    ]);
    const { getBot } = require('../../src/telegram/bot');
    await checkAndNotify();
    expect(getBot().api.sendMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/telegram/notifier.test.ts --no-coverage
```

Expected: FAIL — notifier module not found.

- [ ] **Step 3: Implement notifier.ts**

Create `backend/src/telegram/notifier.ts`:

```typescript
import * as fs from 'fs';
import { readAll } from '../tasks/store';
import { getBot } from './bot';
import { startOfDay, parseISO, isBefore, isEqual, addDays, format } from 'date-fns';
import { InlineKeyboard } from 'grammy';

function getNotificationsFile(): string {
  return process.env.NOTIFICATIONS_FILE || './data/notifications-sent.json';
}

function loadSent(): Record<string, boolean> {
  try {
    return JSON.parse(fs.readFileSync(getNotificationsFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveSent(sent: Record<string, boolean>): void {
  fs.writeFileSync(getNotificationsFile(), JSON.stringify(sent, null, 2));
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function checkAndNotify(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('TELEGRAM_CHAT_ID not set — notifications skipped');
    return;
  }

  const tasks = await readAll();
  const sent = loadSent();
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const bot = getBot();

  for (const task of tasks) {
    if (task.status === 'done' || !task.due_date) continue;

    const dueDate = startOfDay(parseISO(task.due_date));
    const keyboard = new InlineKeyboard().text('View Task', `view:${task.id}`);

    // Overdue
    if (isBefore(dueDate, today)) {
      const key = `${task.id}:overdue:${todayStr()}`;
      if (!sent[key]) {
        await bot.api.sendMessage(
          chatId,
          `⚠️ Overdue: ${task.title} (${task.id})\nDue: ${task.due_date} · Status: ${task.status}`,
          { reply_markup: keyboard }
        );
        sent[key] = true;
      }
      continue;
    }

    // Due today
    if (isEqual(dueDate, today)) {
      const key = `${task.id}:due-today:${task.due_date}`;
      if (!sent[key]) {
        await bot.api.sendMessage(
          chatId,
          `🔔 Due today: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        );
        sent[key] = true;
      }
      continue;
    }

    // Due tomorrow
    if (isEqual(dueDate, tomorrow)) {
      const key = `${task.id}:due-tomorrow:${task.due_date}`;
      if (!sent[key]) {
        await bot.api.sendMessage(
          chatId,
          `📅 Due tomorrow: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        );
        sent[key] = true;
      }
    }
  }

  saveSent(sent);
}
```

- [ ] **Step 4: Run notifier tests**

```bash
cd backend && npx jest tests/telegram/notifier.test.ts --no-coverage
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/telegram/notifier.ts backend/tests/telegram/notifier.test.ts
git commit -m "feat: add Telegram notification system with deduplication"
```

---

### Task 7: Telegram Router + Wire Into App

**Files:**
- Create: `backend/src/telegram/router.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Create telegram router**

Create `backend/src/telegram/router.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { webhookAuth, cronAuth } from './middleware';
import { getBot } from './bot';
import { checkAndNotify } from './notifier';
import { handleAdd } from './commands/add';
import { handleTasks } from './commands/tasks';
import { handleToday } from './commands/today';
import { handleOverdue } from './commands/overdue';
import { handleTask } from './commands/task';
import { handleMove } from './commands/move';
import { handleHelp } from './commands/help';
import { handleCallback } from './callbacks';
import { webhookCallback } from 'grammy';

export const telegramRouter = Router();

// Webhook — no auth at nginx level, validated here
telegramRouter.post('/webhooks/telegram', webhookAuth, async (req: Request, res: Response) => {
  try {
    await webhookCallback(getBot(), 'express')(req, res);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200); // always 200 to prevent Telegram retries
  }
});

// Cron notification trigger
telegramRouter.post('/notifications/check', cronAuth, async (_req: Request, res: Response) => {
  try {
    await checkAndNotify();
    res.json({ ok: true });
  } catch (err) {
    console.error('Notification check error:', err);
    res.status(500).json({ error: 'Notification check failed' });
  }
});

// Status check
telegramRouter.get('/telegram/status', async (_req: Request, res: Response) => {
  try {
    const bot = getBot();
    const me = await bot.api.getMe();
    res.json({ ok: true, bot: me.username });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Bot unreachable' });
  }
});

// Test notification endpoint
telegramRouter.post('/telegram/test', async (_req: Request, res: Response) => {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
    await getBot().api.sendMessage(chatId, '🧪 NexKan test notification');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

export function setupBotCommands(): void {
  const bot = getBot();
  bot.command('add', handleAdd);
  bot.command('tasks', handleTasks);
  bot.command('today', handleToday);
  bot.command('overdue', handleOverdue);
  bot.command('task', handleTask);
  bot.command('move', handleMove);
  bot.command('help', handleHelp);
  bot.on('callback_query:data', handleCallback);
}
```

- [ ] **Step 2: Update app.ts to mount telegram router**

Replace `backend/src/app.ts`:

```typescript
import express from 'express';
import { taskRouter } from './tasks/router';
import { telegramRouter } from './telegram/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);
app.use('/api', telegramRouter);

export default app;
```

- [ ] **Step 3: Update server.ts to register webhook and bot commands on startup**

Replace `backend/src/server.ts`:

```typescript
import app from './app';
import { registerWebhook, getBot } from './telegram/bot';
import { setupBotCommands } from './telegram/router';

const port = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    setupBotCommands();
    await registerWebhook();
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not set — Telegram features disabled');
  }

  app.listen(port, () => {
    console.log(`NexKan backend running on port ${port}`);
  });
}

start().catch(console.error);
```

- [ ] **Step 4: Run full test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/telegram/router.ts backend/src/app.ts backend/src/server.ts
git commit -m "feat: wire Telegram router + bot commands into Express app"
```

---

## Plan Complete

After all 7 tasks:
- Telegram bot handles all commands
- Inline buttons work for task status changes
- Daily notifications with deduplication
- Middleware validates webhook and cron secrets
- All tests passing

**Next:** `2026-05-31-plan4-frontend.md`
