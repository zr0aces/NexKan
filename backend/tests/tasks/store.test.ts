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
