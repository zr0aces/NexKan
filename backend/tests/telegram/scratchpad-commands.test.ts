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
