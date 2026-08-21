import { escapeMd, TelegramPresenter } from '../../src/telegram/presenter';
import { Task, Note } from '@nexkan/shared';

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345',
    title: 'Test Task',
    status: 'todo',
    priority: undefined,
    tags: [],
    sort_order: 1,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    attachments: [],
    description: '',
    ...overrides,
  };
}

describe('TelegramPresenter & escapeMd', () => {
  describe('escapeMd', () => {
    it('escapes markdown characters properly', () => {
      expect(escapeMd('Hello *world* [link] `code` _under_')).toBe(
        'Hello \\*world\\* \\[link\\] \\`code\\` \\_under\\_'
      );
    });
  });

  describe('formatTaskItem', () => {
    const task = createMockTask({
      id: 'abc12345',
      title: 'Fix *urgent* bug',
      priority: 'high',
      tags: ['bug'],
      due_date: '2026-08-30',
      description: 'Bug description',
    });

    it('formats a single task item line with priority and due date', () => {
      const line = TelegramPresenter.formatTaskItem(task);
      expect(line).toBe('• Fix \\*urgent\\* bug (abc12345) [high] · Due: 30 Aug 2026');
    });

    it('formats a single task item line without priority or due date when disabled', () => {
      const line = TelegramPresenter.formatTaskItem(task, { showPriority: false, showDueDate: false });
      expect(line).toBe('• Fix \\*urgent\\* bug (abc12345)');
    });
  });

  describe('formatTaskList', () => {
    it('returns empty string when tasks list is empty', () => {
      expect(TelegramPresenter.formatTaskList('Header', [])).toBe('');
    });

    it('formats a header and task lines', () => {
      const tasks = [createMockTask({ id: '11111111', title: 'Task 1' })];
      const res = TelegramPresenter.formatTaskList('📌 Header:', tasks);
      expect(res).toBe('📌 Header:\n• Task 1 (11111111)');
    });
  });

  describe('formatGroupedTasks', () => {
    it('formats multiple groups separated by newlines', () => {
      const tasks1 = [createMockTask({ id: '11111111', title: 'Task 1', status: 'in-progress' })];
      const tasks2 = [createMockTask({ id: '22222222', title: 'Task 2', status: 'todo' })];

      const res = TelegramPresenter.formatGroupedTasks([
        { header: '🔄 In Progress:', tasks: tasks1 },
        { header: '📌 Todo:', tasks: tasks2 },
        { header: 'Empty:', tasks: [] },
      ]);

      expect(res).toContain('🔄 In Progress:');
      expect(res).toContain('📌 Todo:');
      expect(res).not.toContain('Empty:');
    });
  });

  describe('formatTaskDetail', () => {
    it('formats all task details including tags, description, notes', () => {
      const task = createMockTask({
        id: 'abc12345',
        title: 'Full *Task*',
        status: 'in-progress',
        priority: 'high',
        tags: ['core', 'v1'],
        due_date: '2026-08-30',
        description: 'Detailed description text',
        notes: 'Some additional notes',
      });

      const res = TelegramPresenter.formatTaskDetail(task);
      expect(res).toContain('*Full \\*Task\\**');
      expect(res).toContain('Status: in-progress');
      expect(res).toContain('Priority: high');
      expect(res).toContain('Due: 30 Aug 2026');
      expect(res).toContain('Tags: core, v1');
      expect(res).toContain('_Detailed description text_');
      expect(res).toContain('*Notes:*\nSome additional notes');
    });
  });

  describe('formatNoteItem & formatNoteList', () => {
    it('formats single note item and truncates long text', () => {
      const note: Note = {
        id: 'not12345',
        content: 'Very long note line that exceeds fifty characters limit to verify truncation\nSecond line',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      };

      const formatted = TelegramPresenter.formatNoteItem(note);
      expect(formatted).toContain('• (not12345)');
      expect(formatted).toContain('...');
      expect(formatted).toContain('(...)');
    });

    it('formats empty and non-empty note list', () => {
      expect(TelegramPresenter.formatNoteList([])).toBe('No notes found.');

      const note: Note = {
        id: 'not12345',
        content: 'Short note',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      };
      const list = TelegramPresenter.formatNoteList([note]);
      expect(list).toContain('📝 *Scratchpad Notes:*');
      expect(list).toContain('• (not12345) Short note');
    });
  });

  describe('buildTaskKeyboard', () => {
    it('returns InlineKeyboard object with callback actions', () => {
      const keyboard = TelegramPresenter.buildTaskKeyboard('task1234');
      expect(keyboard).toBeDefined();
      expect(keyboard.inline_keyboard).toBeDefined();
      expect(JSON.stringify(keyboard.inline_keyboard)).toContain('move:task1234:in-progress');
      expect(JSON.stringify(keyboard.inline_keyboard)).toContain('move:task1234:done');
      expect(JSON.stringify(keyboard.inline_keyboard)).toContain('move:task1234:todo');
    });
  });
});
