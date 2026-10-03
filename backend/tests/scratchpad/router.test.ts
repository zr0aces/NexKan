import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import http from 'http';
import { FastifyInstance } from 'fastify';

let tmpDir: string;
let app: FastifyInstance;
let server: http.Server;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-note-router-test-'));
  process.env.SCRATCHPAD_DIR = tmpDir;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-task-router-test-'));
  const { buildApp, defaultTaskStore, defaultNoteStore } = await import('../../src/app');
  app = buildApp(defaultTaskStore, defaultNoteStore);
  await app.ready();
  server = app.server;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

afterEach(async () => {
  const { defaultNoteStore } = await import('../../src/app');
  defaultNoteStore.close();
  fs.readdirSync(tmpDir).filter(f => f.endsWith('.md')).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
});

describe('GET /api/notes', () => {
  it('returns 200 with empty array when no notes', async () => {
    const res = await request(server).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns notes after creation', async () => {
    await request(server).post('/api/notes').send({ content: 'Hello' });
    const res = await request(server).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Hello');
  });
});

describe('POST /api/notes', () => {
  it('creates a note and returns 201', async () => {
    const res = await request(server).post('/api/notes').send({ content: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Buy milk');
    expect(res.body.id).toHaveLength(8);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(server).post('/api/notes').send({});
    expect(res.status).toBe(400);
  });

  it('rejects text/plain POST with 415 (C6)', async () => {
    const res = await request(server).post('/api/notes').set('Content-Type', 'text/plain').send('hello');
    expect(res.status).toBe(415);
  });

  it('rejects application/x-www-form-urlencoded POST with 415 (C6)', async () => {
    const res = await request(server)
      .post('/api/notes')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('content=hello');
    expect(res.status).toBe(415);
  });

  it('rejects __proto__ payload with 400', async () => {
    const res = await request(server)
      .post('/api/notes')
      .set('Content-Type', 'application/json')
      .send('{"__proto__": {"admin": true}}');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('updates note content and returns 200', async () => {
    const created = (await request(server).post('/api/notes').send({ content: 'Original' })).body;
    const res = await request(server).patch(`/api/notes/${created.id}`).send({ content: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(server).patch('/api/notes/notexist').send({ content: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('deletes note and returns 204', async () => {
    const created = (await request(server).post('/api/notes').send({ content: 'To delete' })).body;
    const res = await request(server).delete(`/api/notes/${created.id}`);
    expect(res.status).toBe(204);
  });

  it('accepts DELETE with Content-Type: application/json and empty body (C1)', async () => {
    const created = (await request(server).post('/api/notes').send({ content: 'To delete' })).body;
    const res = await request(server)
      .delete(`/api/notes/${created.id}`)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(204);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(server).delete('/api/notes/notexist');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/notes/:id/convert', () => {
  it('converts note to task and returns 201 task', async () => {
    const note = (await request(server).post('/api/notes').send({ content: 'Buy milk\nFrom the market' })).body;
    const res = await request(server)
      .post(`/api/notes/${note.id}/convert`)
      .send({ due_date: '2099-12-31', priority: 'low' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Buy milk');
    expect(res.body.description).toBe('From the market');
    expect(res.body.status).toBe('todo');
  });

  it('deletes the note after conversion', async () => {
    const note = (await request(server).post('/api/notes').send({ content: 'Single line' })).body;
    await request(server).post(`/api/notes/${note.id}/convert`).send({ due_date: '2099-12-31' });
    const notesRes = await request(server).get('/api/notes');
    expect(notesRes.body).toHaveLength(0);
  });

  it('returns 404 for unknown note id', async () => {
    const res = await request(server).post('/api/notes/notexist/convert').send({ due_date: '2099-12-31' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when due_date is missing and status requires it', async () => {
    const note = (await request(server).post('/api/notes').send({ content: 'No date' })).body;
    const res = await request(server).post(`/api/notes/${note.id}/convert`).send({});
    expect(res.status).toBe(400);
  });
});
