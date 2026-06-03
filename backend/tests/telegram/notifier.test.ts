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
import { getBot } from '../../src/telegram/bot';
import { checkAndNotify } from '../../src/telegram/notifier';
import { Task } from '@nexkan/shared';

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
  // Reset mock return value
  (getBot as jest.Mock).mockReturnValue({
    api: { sendMessage: jest.fn().mockResolvedValue({}) },
  });
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('checkAndNotify', () => {
  it('sends overdue notification for task with past due_date', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', title: 'Old Task', due_date: '2020-01-01', status: 'todo' }),
    ]);
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
    await checkAndNotify();
    await checkAndNotify();
    expect(getBot().api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('skips done tasks', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', due_date: '2020-01-01', status: 'done' }),
    ]);
    await checkAndNotify();
    expect(getBot().api.sendMessage).not.toHaveBeenCalled();
  });

  it('skips tasks without due_date', async () => {
    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', due_date: undefined }),
    ]);
    await checkAndNotify();
    expect(getBot().api.sendMessage).not.toHaveBeenCalled();
  });

  it('prunes obsolete notification keys from the sent cache', async () => {
    // Setup sent cache containing:
    // 1. An overdue key from a previous day for an active task (should be pruned)
    // 2. An overdue key for today for an active task (should be kept)
    // 3. A notification key for a task that is now done or deleted (should be pruned)
    const initialSent = {
      'abc12345:overdue:2020-01-01': true,
      [`abc12345:overdue:${new Date().toISOString().slice(0, 10)}`]: true,
      'done1234:due-today:2020-01-01': true,
    };
    fs.writeFileSync(tmpFile, JSON.stringify(initialSent, null, 2));

    (readAll as jest.Mock).mockResolvedValue([
      makeTask({ id: 'abc12345', due_date: '2020-01-01', status: 'todo' }),
    ]);

    await checkAndNotify();

    const saved = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(saved).toEqual({
      [`abc12345:overdue:${todayStr}`]: true,
    });
  });
});
