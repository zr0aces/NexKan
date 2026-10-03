import request from 'supertest';
import { createContractTestContext, ContractTestContext, makeTask } from './server';

describe('Tasks Contract Tests (Rows 1-7)', () => {
  let ctx: ContractTestContext;

  beforeEach(async () => {
    ctx = await createContractTestContext();
  });

  afterEach(async () => {
    await ctx.close();
  });

  // Row 1: GET /api/tasks
  describe('Row 1: GET /api/tasks', () => {
    it('returns 200 with empty array when no tasks exist', async () => {
      const res = await request(ctx.server).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual([]);
    });

    it('returns 200 with Task[] and respects filters and sorting', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task A', status: 'todo', sort_order: 2, tags: ['frontend'] }));
      ctx.writeTask(makeTask({ id: 'task0002', title: 'Task B', status: 'todo', sort_order: 1, tags: ['backend'] }));

      const res = await request(ctx.server).get('/api/tasks?sort=sort_order:asc&tags=frontend');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('task0001');

      // Verify JSON schema shape: undefined fields must not serialize as null
      const task = res.body[0];
      expect(task).toMatchObject({
        id: 'task0001',
        title: 'Task A',
        status: 'todo',
        sort_order: 2,
        tags: ['frontend'],
      });
      expect(task.notes).toBeUndefined();
      expect(task.telegram_message_id).toBeUndefined();
    });

    it('handles trailing slash /api/tasks/', async () => {
      const res = await request(ctx.server).get('/api/tasks/');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 when repeated query key arrives (F7 parity)', async () => {
      const res = await request(ctx.server).get('/api/tasks?status=todo&status=in-progress');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });

    it('returns 500 on store failure', async () => {
      jest.spyOn(ctx.taskStore, 'readAll').mockRejectedValueOnce(new Error('disk fault'));
      const res = await request(ctx.server).get('/api/tasks');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 2: GET /api/tasks/:id
  describe('Row 2: GET /api/tasks/:id', () => {
    it('returns 200 with Task when found', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'todo' }));
      const res = await request(ctx.server).get('/api/tasks/task0001');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.id).toBe('task0001');
      expect(res.body.title).toBe('Task One');
    });

    it('returns 404 {error: "Task not found"} when not found', async () => {
      const res = await request(ctx.server).get('/api/tasks/notfound1');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('returns 500 on store failure', async () => {
      jest.spyOn(ctx.taskStore, 'readById').mockRejectedValueOnce(new Error('disk fault'));
      const res = await request(ctx.server).get('/api/tasks/task0001');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 3: POST /api/tasks
  describe('Row 3: POST /api/tasks', () => {
    it('returns 201 with Task on valid input', async () => {
      const payload = {
        title: 'New Contract Task',
        status: 'todo',
        due_date: '2026-12-31',
        priority: 'high',
        tags: ['urgent'],
        description: 'Detailed description',
      };
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('New Contract Task');
      expect(res.body.status).toBe('todo');
      expect(res.body.due_date).toBe('2026-12-31');
    });

    it('returns 400 {error: flatten()} on schema validation error', async () => {
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send({ description: 'Missing title and bad due date', due_date: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('fieldErrors');
      expect(res.body.error.fieldErrors).toHaveProperty('title');
    });

    it('returns 400 {error: msg} when due_date missing for todo status', async () => {
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send({ title: 'Task without due date', status: 'todo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/due_date/i);
    });

    it('returns 500 on store failure', async () => {
      jest.spyOn(ctx.taskStore, 'create').mockRejectedValueOnce(new Error('write failure'));
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send({ title: 'Valid Task', status: 'done' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 4: PUT /api/tasks/:id
  describe('Row 4: PUT /api/tasks/:id', () => {
    it('returns 200 with updated Task', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Old Title', status: 'done' }));

      const res = await request(ctx.server)
        .put('/api/tasks/task0001')
        .set('Content-Type', 'application/json')
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('task0001');
      expect(res.body.title).toBe('Updated Title');
    });

    it('returns 400 on invalid schema payload', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'done' }));

      const res = await request(ctx.server)
        .put('/api/tasks/task0001')
        .set('Content-Type', 'application/json')
        .send({ due_date: 'not-a-date' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
    });

    it('returns 400 when due_date rule violated', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'todo', due_date: '2026-12-31' }));

      const res = await request(ctx.server)
        .put('/api/tasks/task0001')
        .set('Content-Type', 'application/json')
        .send({ due_date: null });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/due_date/i);
    });

    it('returns 404 when task not found', async () => {
      const res = await request(ctx.server)
        .put('/api/tasks/missing1')
        .set('Content-Type', 'application/json')
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'done' }));
      jest.spyOn(ctx.taskStore, 'update').mockRejectedValueOnce(new Error('disk crash'));

      const res = await request(ctx.server)
        .put('/api/tasks/task0001')
        .set('Content-Type', 'application/json')
        .send({ title: 'New Title' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 5: PATCH /api/tasks/:id/status
  describe('Row 5: PATCH /api/tasks/:id/status', () => {
    it('returns 200 with updated status', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'todo', due_date: '2026-12-31' }));

      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/status')
        .set('Content-Type', 'application/json')
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
    });

    it('returns 400 on invalid status schema', async () => {
      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/status')
        .set('Content-Type', 'application/json')
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
    });

    it('returns 400 when status requires due_date and none is present or provided', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'done', due_date: undefined }));

      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/status')
        .set('Content-Type', 'application/json')
        .send({ status: 'todo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/due_date/i);
    });

    it('returns 404 when task not found', async () => {
      const res = await request(ctx.server)
        .patch('/api/tasks/missing1/status')
        .set('Content-Type', 'application/json')
        .send({ status: 'done' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'done' }));
      jest.spyOn(ctx.taskStore, 'updateStatus').mockRejectedValueOnce(new Error('fail'));

      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/status')
        .set('Content-Type', 'application/json')
        .send({ status: 'done' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 6: PATCH /api/tasks/:id/order
  describe('Row 6: PATCH /api/tasks/:id/order', () => {
    it('returns 200 with reordered Task', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'todo', sort_order: 1 }));
      ctx.writeTask(makeTask({ id: 'task0002', title: 'Task Two', status: 'todo', sort_order: 2 }));
      ctx.writeTask(makeTask({ id: 'task0003', title: 'Task Three', status: 'todo', sort_order: 3 }));

      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/order')
        .set('Content-Type', 'application/json')
        .send({ position: 2 });

      expect(res.status).toBe(200);
      expect(res.body.sort_order).toBe(3);
    });

    it('returns 400 on invalid order position (negative)', async () => {
      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/order')
        .set('Content-Type', 'application/json')
        .send({ position: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('fieldErrors');
    });

    it('returns 404 when task not found', async () => {
      const res = await request(ctx.server)
        .patch('/api/tasks/missing1/order')
        .set('Content-Type', 'application/json')
        .send({ position: 2 });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task One', status: 'todo' }));
      jest.spyOn(ctx.taskStore, 'updateOrder').mockRejectedValueOnce(new Error('fail'));

      const res = await request(ctx.server)
        .patch('/api/tasks/task0001/order')
        .set('Content-Type', 'application/json')
        .send({ position: 2 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // Row 7: DELETE /api/tasks/:id
  describe('Row 7: DELETE /api/tasks/:id', () => {
    it('returns 204 with empty body on successful delete', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task to delete' }));

      const res = await request(ctx.server).delete('/api/tasks/task0001');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(res.body).toEqual({});
    });

    it('accepts DELETE with Content-Type: application/json and empty body (C1 frontend compatibility)', async () => {
      ctx.writeTask(makeTask({ id: 'task0002', title: 'Task to delete empty body' }));

      const res = await request(ctx.server)
        .delete('/api/tasks/task0002')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('returns 404 when task not found', async () => {
      const res = await request(ctx.server).delete('/api/tasks/notfound1');
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 500 on store failure', async () => {
      ctx.writeTask(makeTask({ id: 'task0001', title: 'Task' }));
      jest.spyOn(ctx.taskStore, 'deleteTask').mockRejectedValueOnce(new Error('fail'));

      const res = await request(ctx.server).delete('/api/tasks/task0001');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
