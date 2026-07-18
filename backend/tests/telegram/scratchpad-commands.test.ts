import { handleNote } from '../../src/telegram/commands/note';
import { handleNotes } from '../../src/telegram/commands/notes';
import { handleDelnote } from '../../src/telegram/commands/delnote';
import { Note } from '@nexkan/shared';
import { NotFoundError } from '../../src/scratchpad/store';

const mockNoteStore = {
  create: jest.fn(),
  readAll: jest.fn(),
  deleteNote: jest.fn(),
} as any;

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleNote', () => {
  it('creates a note with given text', async () => {
    mockNoteStore.create.mockResolvedValue(makeNote({ content: 'Buy milk' }));
    const ctx = makeCtx('Buy milk');
    await handleNote(ctx, mockNoteStore);
    expect(mockNoteStore.create).toHaveBeenCalledWith('Buy milk');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('abc12345'));
  });

  it('replies with usage when text is empty', async () => {
    const ctx = makeCtx('');
    await handleNote(ctx, mockNoteStore);
    expect(mockNoteStore.create).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});

describe('handleNotes', () => {
  it('replies with numbered list when notes exist', async () => {
    mockNoteStore.readAll.mockResolvedValue([
      makeNote({ id: 'aaa11111', content: 'First note' }),
      makeNote({ id: 'bbb22222', content: 'Second note' }),
    ]);
    const ctx = makeCtx();
    await handleNotes(ctx, mockNoteStore);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('aaa11111'),
      expect.any(Object)
    );
  });

  it('replies with no-notes message when list is empty', async () => {
    mockNoteStore.readAll.mockResolvedValue([]);
    const ctx = makeCtx();
    await handleNotes(ctx, mockNoteStore);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('No'));
  });
});

describe('handleDelnote', () => {
  it('deletes note by id and confirms', async () => {
    mockNoteStore.deleteNote.mockResolvedValue(undefined);
    const ctx = makeCtx('abc12345');
    await handleDelnote(ctx, mockNoteStore);
    expect(mockNoteStore.deleteNote).toHaveBeenCalledWith('abc12345');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('deleted'));
  });

  it('replies with not-found when id does not exist', async () => {
    mockNoteStore.deleteNote.mockRejectedValue(new NotFoundError('notexist'));
    const ctx = makeCtx('notexist');
    await handleDelnote(ctx, mockNoteStore);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('replies with usage when id is empty', async () => {
    const ctx = makeCtx('');
    await handleDelnote(ctx, mockNoteStore);
    expect(mockNoteStore.deleteNote).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});
