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
import { Task } from '@nexkan/shared';

function makeCtx(text: string = ''): any {
  return {
    message: { text, chat: { id: 123456 } },
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
  it('replies with command reference including /add and /tasks', async () => {
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

  it('parses natural language date from text', async () => {
    (create as jest.Mock).mockResolvedValue(makeTask());
    const ctx = makeCtx('/add Deploy server tomorrow');
    ctx.match = 'Deploy server tomorrow';
    await handleAdd(ctx);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
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
      makeTask({ id: 'bbb22222', title: 'In Progress Task', status: 'in-progress' }),
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
  it('calls readAll with due_today:true filter', async () => {
    (readAll as jest.Mock).mockResolvedValue([makeTask({ title: 'Due Today Task' })]);
    const ctx = makeCtx('/today');
    await handleToday(ctx);
    expect(readAll).toHaveBeenCalledWith(expect.objectContaining({ due_today: true }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Due Today Task'), expect.anything());
  });
});

describe('handleOverdue', () => {
  it('calls readAll with overdue:true filter', async () => {
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
    (readById as jest.Mock).mockResolvedValue(makeTask({ id: 'abc12345', due_date: undefined, status: 'done' }));
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
