import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, Note, TaskPriority, TaskStatus } from '@nexkan/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  tasks: {
    get(id: string): Promise<Task> {
      return request<Task>(`/tasks/${id}`);
    },

    list(filters: TaskFilters = {}): Promise<Task[]> {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const qs = params.toString();
      return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
    },

    create(input: CreateTaskInput): Promise<Task> {
      return request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    update(id: string, input: UpdateTaskInput): Promise<Task> {
      return request<Task>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },

    updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
      return request<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, due_date }),
      });
    },

    updateOrder(id: string, position: number): Promise<Task> {
      return request<Task>(`/tasks/${id}/order`, {
        method: 'PATCH',
        body: JSON.stringify({ position }),
      });
    },

    delete(id: string): Promise<void> {
      return request<void>(`/tasks/${id}`, { method: 'DELETE' });
    },
  },

  notes: {
    list(): Promise<Note[]> {
      return request<Note[]>('/notes');
    },

    create(content: string): Promise<Note> {
      return request<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },

    update(id: string, content: string): Promise<Note> {
      return request<Note>(`/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
    },

    delete(id: string): Promise<void> {
      return request<void>(`/notes/${id}`, { method: 'DELETE' });
    },

    convert(
      id: string,
      opts: { due_date?: string; priority?: TaskPriority; status?: TaskStatus }
    ): Promise<Task> {
      return request<Task>(`/notes/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify(opts),
      });
    },
  },
};
