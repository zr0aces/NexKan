import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readAll, readById, create, update, updateStatus, updateOrder, deleteTask } from '../../src/tasks/store';
import { serializeTask } from '../../src/tasks/parser';
import { Task } from '@nexkan/shared';

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
    const tasks = await readAll({ sort: 'sort_order:asc' });
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

describe('create', () => {
  it('creates a file with generated ID and correct frontmatter', async () => {
    const task = await create({ title: 'New Task', due_date: '2099-12-31', description: 'Do it.' });
    expect(task.id).toHaveLength(8);
    expect(task.title).toBe('New Task');
    expect(task.status).toBe('todo');
    expect(task.sort_order).toBe(1);
    expect(task.created_at).toBeTruthy();
    expect(task.updated_at).toBeTruthy();

    // Verify file exists on disk
    const files = fs.readdirSync(tmpDir);
    expect(files.some(f => f.startsWith(task.id))).toBe(true);
  });

  it('assigns sort_order = max + 1 in column', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Existing', status: 'todo', sort_order: 5 }));
    const task = await create({ title: 'New Task', status: 'todo', due_date: '2099-12-31', description: 'x' });
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

  it('throws when task does not exist', async () => {
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
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'done', due_date: undefined }));
    await expect(updateStatus('abc12345', 'todo')).rejects.toThrow('due_date');
  });

  it('accepts due_date when moving to todo', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'done', due_date: undefined }));
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
    const tasks = await readAll({ status: 'todo', sort: 'sort_order:asc' });
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

  it('throws when task does not exist', async () => {
    await expect(deleteTask('notexist')).rejects.toThrow('not found');
  });
});
