import { TaskService } from '../../src/tasks/service';
import { TaskStore } from '../../src/tasks/store';
import { InMemoryStorageProvider } from '../../src/storage/inMemory';

describe('TaskService', () => {
  let storage: InMemoryStorageProvider;
  let store: TaskStore;
  let service: TaskService;

  beforeEach(() => {
    storage = new InMemoryStorageProvider();
    store = new TaskStore(storage);
    service = new TaskService(store);
  });

  afterEach(() => {
    store.close();
  });

  describe('createTask', () => {
    it('creates a task with required due_date for todo status', async () => {
      const task = await service.createTask({
        title: 'Test Service Task',
        status: 'todo',
        due_date: '2026-08-30',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Service Task');
      expect(task.status).toBe('todo');
      expect(task.due_date).toBe('2026-08-30');
    });

    it('throws error when due_date is missing for todo status', async () => {
      await expect(
        service.createTask({
          title: 'Missing Due Date',
          status: 'todo',
        })
      ).rejects.toThrow('due_date is required for task status "todo"');
    });

    it('throws error when due_date is missing for in-progress status', async () => {
      await expect(
        service.createTask({
          title: 'Missing Due Date',
          status: 'in-progress',
        })
      ).rejects.toThrow('due_date is required for task status "in-progress"');
    });

    it('allows creating done task without due_date', async () => {
      const task = await service.createTask({
        title: 'Done Task',
        status: 'done',
      });

      expect(task.status).toBe('done');
      expect(task.due_date).toBeUndefined();
    });
  });

  describe('getTask and listTasks', () => {
    it('retrieves created task by id', async () => {
      const created = await service.createTask({
        title: 'Find Me',
        status: 'todo',
        due_date: '2026-08-30',
      });

      const found = await service.getTask(created.id);
      expect(found).toEqual(created);
    });

    it('returns null for non-existent task', async () => {
      const found = await service.getTask('nonexist');
      expect(found).toBeNull();
    });

    it('lists tasks with filters', async () => {
      await service.createTask({ title: 'Task 1', status: 'todo', due_date: '2026-08-30', priority: 'high' });
      await service.createTask({ title: 'Task 2', status: 'done', priority: 'low' });

      const all = await service.listTasks();
      expect(all).toHaveLength(2);

      const highPriority = await service.listTasks({ priority: 'high' });
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].title).toBe('Task 1');
    });
  });

  describe('updateTask', () => {
    it('updates task properties', async () => {
      const created = await service.createTask({
        title: 'Original Title',
        status: 'todo',
        due_date: '2026-08-30',
      });

      const updated = await service.updateTask(created.id, {
        title: 'Updated Title',
        notes: 'Some notes',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.notes).toBe('Some notes');
    });

    it('throws error when updating non-existent task', async () => {
      await expect(
        service.updateTask('nonexist', { title: 'New' })
      ).rejects.toThrow('Task nonexist not found');
    });

    it('throws error when clearing due_date on todo task', async () => {
      const created = await service.createTask({
        title: 'Keep Due Date',
        status: 'todo',
        due_date: '2026-08-30',
      });

      await expect(
        service.updateTask(created.id, { due_date: null })
      ).rejects.toThrow('due_date is required for task status "todo"');
    });
  });

  describe('updateTaskStatus', () => {
    it('updates status to in-progress retaining due_date', async () => {
      const created = await service.createTask({
        title: 'Move Me',
        status: 'todo',
        due_date: '2026-08-30',
      });

      const updated = await service.updateTaskStatus(created.id, 'in-progress');
      expect(updated.status).toBe('in-progress');
      expect(updated.due_date).toBe('2026-08-30');
    });

    it('allows moving to done without due_date', async () => {
      const created = await service.createTask({
        title: 'Move to Done',
        status: 'todo',
        due_date: '2026-08-30',
      });

      const updated = await service.updateTaskStatus(created.id, 'done');
      expect(updated.status).toBe('done');
    });

    it('throws error if moving non-existent task', async () => {
      await expect(
        service.updateTaskStatus('nonexist', 'done')
      ).rejects.toThrow('Task nonexist not found');
    });

    it('throws error if moving task without due_date into todo without supplying new due_date', async () => {
      const created = await service.createTask({
        title: 'Done without due date',
        status: 'done',
      });

      await expect(
        service.updateTaskStatus(created.id, 'todo')
      ).rejects.toThrow('due_date is required for task status "todo"');
    });

    it('succeeds if moving done task to todo when supplying new due_date', async () => {
      const created = await service.createTask({
        title: 'Done task revived',
        status: 'done',
      });

      const revived = await service.updateTaskStatus(created.id, 'todo', '2026-09-01');
      expect(revived.status).toBe('todo');
      expect(revived.due_date).toBe('2026-09-01');
    });
  });

  describe('updateOrder and deleteTask', () => {
    it('reorders and deletes tasks', async () => {
      const t1 = await service.createTask({ title: 'T1', status: 'todo', due_date: '2026-08-30' });
      const t2 = await service.createTask({ title: 'T2', status: 'todo', due_date: '2026-08-30' });

      const reordered = await service.updateOrder(t2.id, 0);
      expect(reordered.sort_order).toBe(1);

      await service.deleteTask(t1.id);
      expect(await service.getTask(t1.id)).toBeNull();
    });
  });
});
