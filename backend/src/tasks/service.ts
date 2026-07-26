import {
  Task,
  TaskStatus,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
  requiresDueDate,
} from '@nexkan/shared';
import { TaskStore } from './store';

export class TaskService {
  constructor(private readonly store: TaskStore) {}

  async getTask(id: string): Promise<Task | null> {
    return this.store.readById(id);
  }

  async listTasks(filters: TaskFilters = {}): Promise<Task[]> {
    return this.store.readAll(filters);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const status = input.status ?? 'todo';
    if (requiresDueDate(status) && !input.due_date) {
      throw new Error(`due_date is required for task status "${status}"`);
    }
    return this.store.create(input);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.store.readById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const effectiveStatus = existing.status;
    const effectiveDueDate = input.due_date === null ? undefined : (input.due_date ?? existing.due_date);

    if (requiresDueDate(effectiveStatus) && !effectiveDueDate) {
      throw new Error(`due_date is required for task status "${effectiveStatus}"`);
    }

    return this.store.update(id, input);
  }

  async updateTaskStatus(id: string, status: TaskStatus, due_date?: string): Promise<Task> {
    const existing = await this.store.readById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const effectiveDueDate = due_date ?? existing.due_date;
    if (requiresDueDate(status) && !effectiveDueDate) {
      throw new Error(`due_date is required for task status "${status}"`);
    }

    return this.store.updateStatus(id, status, due_date);
  }

  async updateOrder(id: string, position: number): Promise<Task> {
    return this.store.updateOrder(id, position);
  }

  async deleteTask(id: string): Promise<void> {
    return this.store.deleteTask(id);
  }
}
