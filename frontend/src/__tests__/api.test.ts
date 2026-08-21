import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';

describe('Frontend API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('api.tasks', () => {
    it('calls GET /api/tasks/:id correctly', async () => {
      const mockTask = { id: 'task1', title: 'Task 1', status: 'todo' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTask,
      } as any);

      const res = await api.tasks.get('task1');
      expect(res).toEqual(mockTask);
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/tasks/task1'), expect.any(Object));
    });

    it('serializes query parameters in list()', async () => {
      const mockTasks = [{ id: 'task1', title: 'Task 1' }];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTasks,
      } as any);

      const res = await api.tasks.list({ status: 'todo', overdue: true });
      expect(res).toEqual(mockTasks);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/tasks\?.*status=todo.*overdue=true/),
        expect.any(Object)
      );
    });

    it('posts task creation to /api/tasks', async () => {
      const mockCreated = { id: 'task2', title: 'New Task', status: 'todo' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockCreated,
      } as any);

      const res = await api.tasks.create({ title: 'New Task', due_date: '2026-08-30' });
      expect(res).toEqual(mockCreated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'New Task', due_date: '2026-08-30' }),
        })
      );
    });

    it('updates task with PUT /api/tasks/:id', async () => {
      const mockUpdated = { id: 'task1', title: 'Updated Title' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as any);

      const res = await api.tasks.update('task1', { title: 'Updated Title' });
      expect(res).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'Updated Title' }),
        })
      );
    });

    it('updates status with PATCH /api/tasks/:id/status', async () => {
      const mockUpdated = { id: 'task1', status: 'in-progress' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as any);

      const res = await api.tasks.updateStatus('task1', 'in-progress', '2026-09-01');
      expect(res).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task1/status'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'in-progress', due_date: '2026-09-01' }),
        })
      );
    });

    it('updates task ordering with PATCH /api/tasks/:id/order', async () => {
      const mockUpdated = { id: 'task1', sort_order: 2 };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as any);

      const res = await api.tasks.updateOrder('task1', 2);
      expect(res).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task1/order'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ position: 2 }),
        })
      );
    });

    it('deletes task with DELETE /api/tasks/:id and handles 204 response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as any);

      const res = await api.tasks.delete('task1');
      expect(res).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('api.notes', () => {
    it('handles list and create notes', async () => {
      const mockNote = { id: 'note1', content: 'Note content' };
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [mockNote],
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockNote,
        } as any);

      const notes = await api.notes.list();
      expect(notes).toEqual([mockNote]);

      const created = await api.notes.create('Note content');
      expect(created).toEqual(mockNote);
    });

    it('updates note with PATCH /api/notes/:id', async () => {
      const mockUpdated = { id: 'note1', content: 'New Note Content' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUpdated,
      } as any);

      const res = await api.notes.update('note1', 'New Note Content');
      expect(res).toEqual(mockUpdated);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/notes/note1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ content: 'New Note Content' }),
        })
      );
    });

    it('deletes note with DELETE /api/notes/:id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as any);

      const res = await api.notes.delete('note1');
      expect(res).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/notes/note1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('converts note to task with POST /api/notes/:id/convert', async () => {
      const mockConvertedTask = { id: 'task-from-note', title: 'Note Title', status: 'todo' };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockConvertedTask,
      } as any);

      const res = await api.notes.convert('note1', { due_date: '2026-08-30', priority: 'high', status: 'todo' });
      expect(res).toEqual(mockConvertedTask);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/notes/note1/convert'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ due_date: '2026-08-30', priority: 'high', status: 'todo' }),
        })
      );
    });

    it('throws error when response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Task not found' }),
      } as any);

      await expect(api.tasks.get('invalid')).rejects.toThrow('Task not found');
    });
  });
});
