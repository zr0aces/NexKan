import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { serializeTask } from '../../src/tasks/parser';
import { Task } from '../../src/types/task';

let tmpDir: string;
let app: typeof import('../../src/app').default;

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

function writeTask(task: Task): void {
  const slug = task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const filename = `${task.id}-${slug}.md`;
  fs.writeFileSync(path.join(tmpDir, filename), serializeTask(task));
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-router-test-'));
  process.env.DATA_DIR = tmpDir;
  app = (await import('../../src/app')).default;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
});

describe('GET /api/tasks', () => {
  it('returns 200 with empty array', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns tasks sorted by sort_order', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Task A', sort_order: 2 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Task B', sort_order: 1 }));
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('bbb22222');
    expect(res.body[1].id).toBe('aaa11111');
  });

  it('filters by ?status=', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Todo Task', status: 'todo' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Done Task', status: 'done', due_date: undefined }));
    const res = await request(app).get('/api/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('aaa11111');
  });

  it('filters by ?search=', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'Buy milk' }));
    writeTask(makeTask({ id: 'bbb22222', title: 'Deploy server' }));
    const res = await request(app).get('/api/tasks?search=milk');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('aaa11111');
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns 200 with task', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'My Task' }));
    const res = await request(app).get('/api/tasks/abc12345');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc12345');
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).get('/api/tasks/notexist');
    expect(res.status).toBe(404);
  });
});
