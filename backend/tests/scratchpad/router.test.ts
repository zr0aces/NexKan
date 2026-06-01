import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tmpDir: string;
let app: typeof import('../../src/app').default;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-note-router-test-'));
  process.env.SCRATCHPAD_DIR = tmpDir;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-task-router-test-'));
  app = (await import('../../src/app')).default;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

afterEach(() => {
  fs.readdirSync(tmpDir).filter(f => f.endsWith('.md')).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
});

describe('GET /api/notes', () => {
  it('returns 200 with empty array when no notes', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns notes after creation', async () => {
    await request(app).post('/api/notes').send({ content: 'Hello' });
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Hello');
  });
});

describe('POST /api/notes', () => {
  it('creates a note and returns 201', async () => {
    const res = await request(app).post('/api/notes').send({ content: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Buy milk');
    expect(res.body.id).toHaveLength(8);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/api/notes').send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('updates note content and returns 200', async () => {
    const created = (await request(app).post('/api/notes').send({ content: 'Original' })).body;
    const res = await request(app).patch(`/api/notes/${created.id}`).send({ content: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/notes/notexist').send({ content: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('deletes note and returns 204', async () => {
    const created = (await request(app).post('/api/notes').send({ content: 'To delete' })).body;
    const res = await request(app).delete(`/api/notes/${created.id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/notes/notexist');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/notes/:id/convert', () => {
  it('converts note to task and returns 201 task', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'Buy milk\nFrom the market' })).body;
    const res = await request(app)
      .post(`/api/notes/${note.id}/convert`)
      .send({ due_date: '2099-12-31', priority: 'low' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Buy milk');
    expect(res.body.description).toBe('From the market');
    expect(res.body.status).toBe('todo');
  });

  it('deletes the note after conversion', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'Single line' })).body;
    await request(app).post(`/api/notes/${note.id}/convert`).send({ due_date: '2099-12-31' });
    const notesRes = await request(app).get('/api/notes');
    expect(notesRes.body).toHaveLength(0);
  });

  it('returns 404 for unknown note id', async () => {
    const res = await request(app).post('/api/notes/notexist/convert').send({ due_date: '2099-12-31' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when due_date is missing and status requires it', async () => {
    const note = (await request(app).post('/api/notes').send({ content: 'No date' })).body;
    const res = await request(app).post(`/api/notes/${note.id}/convert`).send({});
    expect(res.status).toBe(400);
  });
});
