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
    const res = await request(app).get('/api/tasks?sort=sort_order:asc');
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

describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'New Task', due_date: '2099-12-31', description: 'Do it.' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('New Task');
    expect(res.body.status).toBe('todo');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/tasks').send({ description: 'No title' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tasks/:id', () => {
  it('updates a task and returns 200', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Original' }));
    const res = await request(app)
      .put('/api/tasks/abc12345')
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app).put('/api/tasks/notexist').send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  it('moves task to new status', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'done' }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'todo', due_date: '2099-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('todo');
  });

  it('returns 400 when moving to todo without due_date', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task', status: 'done', due_date: undefined }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'todo' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'Task' }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/status')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app)
      .patch('/api/tasks/notexist/status')
      .send({ status: 'done' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id/order', () => {
  it('reorders task within column and returns 200', async () => {
    writeTask(makeTask({ id: 'aaa11111', title: 'A', status: 'todo', sort_order: 1 }));
    writeTask(makeTask({ id: 'bbb22222', title: 'B', status: 'todo', sort_order: 2 }));
    writeTask(makeTask({ id: 'abc12345', title: 'C', status: 'todo', sort_order: 3 }));
    const res = await request(app)
      .patch('/api/tasks/abc12345/order')
      .send({ position: 0 });
    expect(res.status).toBe(200);
    expect(res.body.sort_order).toBe(1);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    writeTask(makeTask({ id: 'abc12345', title: 'To Delete' }));
    const res = await request(app).delete('/api/tasks/abc12345');
    expect(res.status).toBe(204);
    const check = await request(app).get('/api/tasks/abc12345');
    expect(check.status).toBe(404);
  });

  it('returns 404 when task not found', async () => {
    const res = await request(app).delete('/api/tasks/notexist');
    expect(res.status).toBe(404);
  });
});
