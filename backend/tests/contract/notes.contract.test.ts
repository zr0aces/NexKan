import request from 'supertest';
import { createContractTestContext, ContractTestContext, makeNote } from './server';

describe('Notes Contract Tests (Rows 8-12)', () => {
  let ctx: ContractTestContext;

  beforeEach(async () => {
    ctx = await createContractTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  // Row 8: GET /api/notes
  describe('Row 8: GET /api/notes', () => {
    it('returns 200 with empty array when no notes exist', async () => {
      const res = await request(ctx.server).get('/api/notes');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual([]);
    });

    it('returns 200 with Note[]', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Buy milk' }));
      const res = await request(ctx.server).get('/api/notes');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 'note0001',
        content: 'Buy milk',
      });
      expect(res.body[0].created_at).toBeDefined();
      expect(res.body[0].updated_at).toBeDefined();
    });

    it('returns 500 on store failure', async () => {
      jest.spyOn(ctx.noteStore, 'readAll').mockRejectedValueOnce(new Error('fail'));
      const res = await request(ctx.server).get('/api/notes');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 9: POST /api/notes
  describe('Row 9: POST /api/notes', () => {
    it('returns 201 with Note on valid content', async () => {
      const res = await request(ctx.server)
        .post('/api/notes')
        .set('Content-Type', 'application/json')
        .send({ content: 'Quick note content' });

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.id).toBeDefined();
      expect(res.body.content).toBe('Quick note content');
    });

    it('returns 400 on empty or missing content', async () => {
      const res = await request(ctx.server)
        .post('/api/notes')
        .set('Content-Type', 'application/json')
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
      expect(res.body.error.fieldErrors).toHaveProperty('content');
    });

    it('returns 500 on store failure', async () => {
      jest.spyOn(ctx.noteStore, 'create').mockRejectedValueOnce(new Error('fail'));
      const res = await request(ctx.server)
        .post('/api/notes')
        .set('Content-Type', 'application/json')
        .send({ content: 'Valid content' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 10: PATCH /api/notes/:id
  describe('Row 10: PATCH /api/notes/:id', () => {
    it('returns 200 with updated Note', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Initial text' }));

      const res = await request(ctx.server)
        .patch('/api/notes/note0001')
        .set('Content-Type', 'application/json')
        .send({ content: 'Updated text' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('note0001');
      expect(res.body.content).toBe('Updated text');
    });

    it('returns 400 on empty content', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Initial text' }));

      const res = await request(ctx.server)
        .patch('/api/notes/note0001')
        .set('Content-Type', 'application/json')
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
    });

    it('returns 404 when note not found', async () => {
      const res = await request(ctx.server)
        .patch('/api/notes/missing1')
        .set('Content-Type', 'application/json')
        .send({ content: 'Updated text' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Initial' }));
      jest.spyOn(ctx.noteStore, 'update').mockRejectedValueOnce(new Error('fail'));

      const res = await request(ctx.server)
        .patch('/api/notes/note0001')
        .set('Content-Type', 'application/json')
        .send({ content: 'Updated' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 11: DELETE /api/notes/:id
  describe('Row 11: DELETE /api/notes/:id', () => {
    it('returns 204 with empty body on successful delete', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Delete me' }));

      const res = await request(ctx.server).delete('/api/notes/note0001');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(res.body).toEqual({});
    });

    it('accepts DELETE with Content-Type: application/json and empty body (C1 frontend compatibility)', async () => {
      ctx.writeNote(makeNote({ id: 'note0002', content: 'Delete me empty body' }));

      const res = await request(ctx.server)
        .delete('/api/notes/note0002')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('returns 404 when note not found', async () => {
      const res = await request(ctx.server).delete('/api/notes/missing1');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Delete me' }));
      jest.spyOn(ctx.noteStore, 'deleteNote').mockRejectedValueOnce(new Error('fail'));

      const res = await request(ctx.server).delete('/api/notes/note0001');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 12: POST /api/notes/:id/convert
  describe('Row 12: POST /api/notes/:id/convert', () => {
    it('returns 201 with Task on successful conversion', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Task Title\nTask Description line 1\nLine 2' }));

      const res = await request(ctx.server)
        .post('/api/notes/note0001/convert')
        .set('Content-Type', 'application/json')
        .send({ due_date: '2026-12-31', priority: 'medium', status: 'todo' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Task Title');
      expect(res.body.description).toBe('Task Description line 1\nLine 2');
      expect(res.body.due_date).toBe('2026-12-31');
      expect(res.body.status).toBe('todo');

      // Note should be deleted
      const noteCheck = await request(ctx.server).get('/api/notes');
      expect(noteCheck.body).toEqual([]);
    });

    it('returns 400 on schema error (e.g. invalid date)', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Title' }));

      const res = await request(ctx.server)
        .post('/api/notes/note0001/convert')
        .set('Content-Type', 'application/json')
        .send({ due_date: 'invalid-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
    });

    it('returns 400 when note first line is empty', async () => {
      jest.spyOn(ctx.noteStore, 'readById').mockResolvedValueOnce(makeNote({ id: 'note0001', content: '' }));

      const res = await request(ctx.server)
        .post('/api/notes/note0001/convert')
        .set('Content-Type', 'application/json')
        .send({ due_date: '2026-12-31' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/first line/i);
    });

    it('returns 400 when status requires due_date and it is missing', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Task Title\nDescription' }));

      const res = await request(ctx.server)
        .post('/api/notes/note0001/convert')
        .set('Content-Type', 'application/json')
        .send({ status: 'todo' }); // todo requires due_date

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/due_date/i);
    });

    it('returns 404 when note not found', async () => {
      const res = await request(ctx.server)
        .post('/api/notes/missing1/convert')
        .set('Content-Type', 'application/json')
        .send({ due_date: '2026-12-31' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on unexpected conversion error', async () => {
      ctx.writeNote(makeNote({ id: 'note0001', content: 'Title' }));
      jest.spyOn(ctx.taskStore, 'create').mockRejectedValueOnce(new Error('crash'));

      const res = await request(ctx.server)
        .post('/api/notes/note0001/convert')
        .set('Content-Type', 'application/json')
        .send({ due_date: '2026-12-31' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
