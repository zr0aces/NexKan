import { handleCallback } from '../../src/telegram/callbacks';
import { Task } from '@nexkan/shared';

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

const mockTaskStore = {
  updateStatus: jest.fn(),
  readById: jest.fn(),
} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleCallback', () => {
  it('handles move:{id}:{status} — moves task', async () => {
    mockTaskStore.updateStatus.mockResolvedValue(makeTask({ status: 'done' }));
    const ctx = makeCtx('move:abc12345:done');
    await handleCallback(ctx, mockTaskStore);
    expect(mockTaskStore.updateStatus).toHaveBeenCalledWith('abc12345', 'done', undefined);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining('done') });
  });

  it('handles move error with due_date message', async () => {
    mockTaskStore.updateStatus.mockRejectedValue(new Error('due_date is required'));
    const ctx = makeCtx('move:abc12345:todo');
    await handleCallback(ctx, mockTaskStore);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({ text: expect.stringContaining('due date') });
  });

  it('ignores unknown callback data', async () => {
    const ctx = makeCtx('unknown:data');
    await handleCallback(ctx, mockTaskStore);
    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
  });
});
