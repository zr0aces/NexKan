import { nanoid } from 'nanoid';
import { parseTask, serializeTask } from './parser';
import { Task, TaskStatus, TaskFilters, CreateTaskInput, UpdateTaskInput, parseLocalDate, requiresDueDate, isOverdue } from '@nexkan/shared';
import { startOfDay, isEqual, addDays } from 'date-fns';
import { StorageProvider } from '../storage/types';

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
}

interface TaskEntry {
  task: Task;
  filePath: string; // Acts as the relative filename within the storage provider
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Task ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class TaskStore {
  private readonly cache = new Map<string, TaskEntry>();
  private loaded = false;

  constructor(private readonly storageProvider: StorageProvider) {}

  private async ensureCacheLoaded(): Promise<void> {
    if (this.loaded) return;

    let files: string[] = [];
    try {
      files = await this.storageProvider.list('.md');
    } catch (err) {
      // Ignored - empty list
    }

    const entries = await Promise.all(
      files.map(async filename => {
        try {
          const content = await this.storageProvider.read(filename);
          return { task: parseTask(content, filename), filename };
        } catch {
          console.error(`Skipping corrupted task file: ${filename}`);
          return null;
        }
      })
    );

    this.cache.clear();
    for (const entry of entries) {
      if (entry) {
        this.cache.set(entry.task.id, { task: entry.task, filePath: entry.filename });
      }
    }

    this.loaded = true;
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    this.storageProvider.watch(async (eventType, filename) => {
      if (!filename.endsWith('.md')) return;

      const id = filename.split('-')[0];
      if (!id || id.length !== 8) return;

      try {
        if (await this.storageProvider.exists(filename)) {
          const content = await this.storageProvider.read(filename);
          const task = parseTask(content, filename);
          this.cache.set(id, { task, filePath: filename });
        } else {
          this.cache.delete(id);
        }
      } catch (err) {
        // Silently skip if concurrent read/delete issues
      }
    });
  }

  private async readAllEntries(): Promise<TaskEntry[]> {
    await this.ensureCacheLoaded();
    return Array.from(this.cache.values());
  }

  private async readAllFiles(): Promise<Task[]> {
    return (await this.readAllEntries()).map(e => e.task);
  }

  private async findEntry(id: string): Promise<TaskEntry | null> {
    await this.ensureCacheLoaded();
    return this.cache.get(id) ?? null;
  }

  private todayDate(): Date {
    return startOfDay(new Date());
  }

  private applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
    let result = tasks;
    const todayD = this.todayDate();
    const tomorrowD = addDays(todayD, 1);

    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      result = result.filter(t => statuses.includes(t.status));
    }

    if (filters.priority) {
      result = result.filter(t => t.priority === filters.priority);
    }

    if (filters.tags) {
      const tagList = filters.tags.split(',').map(s => s.trim());
      result = result.filter(t => tagList.some(tag => t.tags.includes(tag)));
    }

    if (filters.overdue) {
      result = result.filter(t => t.due_date !== undefined && isOverdue(t.due_date, t.status, todayD));
    }

    if (filters.due_today) {
      result = result.filter(t => t.due_date !== undefined && isEqual(startOfDay(parseLocalDate(t.due_date)), todayD));
    }

    if (filters.due_tomorrow) {
      result = result.filter(t => t.due_date !== undefined && isEqual(startOfDay(parseLocalDate(t.due_date)), tomorrowD));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }

  private applySorting(tasks: Task[], sort?: string): Task[] {
    const sorted = [...tasks];
    switch (sort) {
      case 'due_date:desc':
        return sorted.sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''));
      case 'priority:desc': {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return sorted.sort((a, b) => (order[a.priority ?? 'low'] ?? 2) - (order[b.priority ?? 'low'] ?? 2));
      }
      case 'created_at:desc':
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
      case 'sort_order:asc':
        return sorted.sort((a, b) => a.sort_order - b.sort_order);
      case 'due_date:asc':
      default:
        return sorted.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    }
  }

  async readAll(filters: TaskFilters = {}): Promise<Task[]> {
    const tasks = await this.readAllFiles();
    const filtered = this.applyFilters(tasks, filters);
    return this.applySorting(filtered, filters.sort);
  }

  async readById(id: string): Promise<Task | null> {
    return (await this.findEntry(id))?.task ?? null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const id = nanoid(8);
    const status = input.status ?? 'todo';
    if (requiresDueDate(status) && !input.due_date) {
      throw new Error(`due_date is required when creating a task with status ${status}`);
    }
    const now = new Date().toISOString();

    const allTasks = await this.readAllFiles();
    const inColumn = allTasks.filter(t => t.status === status);
    const sortOrder = inColumn.length > 0 ? Math.max(...inColumn.map(t => t.sort_order)) + 1 : 1;

    const task: Task = {
      id,
      title: input.title,
      status,
      tags: input.tags ?? [],
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
      attachments: [],
      description: input.description ?? '',
      priority: input.priority,
      due_date: input.due_date,
      notes: input.notes,
    };

    const filename = `${id}-${toSlug(input.title)}.md`;
    await this.storageProvider.write(filename, serializeTask(task));

    await this.ensureCacheLoaded();
    this.cache.set(id, { task, filePath: filename });

    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const entry = await this.findEntry(id);
    if (!entry) throw new NotFoundError(id);
    const { task, filePath } = entry;

    const updated: Task = { ...task, updated_at: new Date().toISOString() };

    if (input.title !== undefined) updated.title = input.title;
    if (input.description !== undefined) updated.description = input.description;
    if (input.notes !== undefined) updated.notes = input.notes;
    if (input.priority !== undefined) updated.priority = input.priority;
    if (input.tags !== undefined) updated.tags = input.tags;
    if (input.sort_order !== undefined) updated.sort_order = input.sort_order;
    if (input.telegram_message_id !== undefined) updated.telegram_message_id = input.telegram_message_id;
    if (input.due_date === null) {
      updated.due_date = undefined;
    } else if (input.due_date !== undefined) {
      updated.due_date = input.due_date;
    }

    let finalFilePath = filePath;
    let oldFilePathToDelete: string | null = null;
    if (input.title !== undefined && input.title !== task.title) {
      const newFilename = `${id}-${toSlug(input.title)}.md`;
      finalFilePath = newFilename;
      oldFilePathToDelete = filePath;
    }

    await this.storageProvider.write(finalFilePath, serializeTask(updated));

    if (oldFilePathToDelete) {
      try {
        await this.storageProvider.delete(oldFilePathToDelete);
      } catch {}
    }

    await this.ensureCacheLoaded();
    this.cache.set(id, { task: updated, filePath: finalFilePath });

    return updated;
  }

  async updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
    const entries = await this.readAllEntries();
    const entry = entries.find(e => e.task.id === id);
    if (!entry) throw new NotFoundError(id);
    const { task, filePath } = entry;

    const effectiveDueDate = due_date ?? task.due_date;
    if (requiresDueDate(status as TaskStatus) && !effectiveDueDate) {
      throw new Error(`due_date is required when moving to ${status}`);
    }

    const inTargetColumn = entries.filter(e => e.task.status === status && e.task.id !== id);
    const sortOrder = inTargetColumn.length > 0
      ? Math.max(...inTargetColumn.map(e => e.task.sort_order)) + 1
      : 1;

    const updated: Task = {
      ...task,
      status: status as Task['status'],
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
      due_date: due_date ?? task.due_date,
    };

    await this.storageProvider.write(filePath, serializeTask(updated));

    await this.ensureCacheLoaded();
    this.cache.set(id, { task: updated, filePath });

    return updated;
  }

  async updateOrder(id: string, position: number): Promise<Task> {
    const entries = await this.readAllEntries();
    const entry = entries.find(e => e.task.id === id);
    if (!entry) throw new NotFoundError(id);

    const inColumn = entries
      .filter(e => e.task.status === entry.task.status)
      .sort((a, b) => a.task.sort_order - b.task.sort_order);

    const others = inColumn.filter(e => e.task.id !== id);
    others.splice(position, 0, entry);

    const snapshots = others.map((e, i) => ({
      filePath: e.filePath,
      original: e.task,
      updated: { ...e.task, sort_order: i + 1, updated_at: new Date().toISOString() },
    }));

    try {
      await Promise.all(
        snapshots.map(snap => this.storageProvider.write(snap.filePath, serializeTask(snap.updated)))
      );
      await this.ensureCacheLoaded();
      for (const snap of snapshots) {
        this.cache.set(snap.updated.id, { task: snap.updated, filePath: snap.filePath });
      }
    } catch (err) {
      await Promise.allSettled(
        snapshots.map(snap => this.storageProvider.write(snap.filePath, serializeTask(snap.original)))
      );
      await this.ensureCacheLoaded();
      for (const snap of snapshots) {
        this.cache.set(snap.original.id, { task: snap.original, filePath: snap.filePath });
      }
      throw err;
    }

    const updated = await this.readById(id);
    if (!updated) throw new NotFoundError(id);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    const entry = await this.findEntry(id);
    if (!entry) throw new NotFoundError(id);
    await this.storageProvider.delete(entry.filePath);

    await this.ensureCacheLoaded();
    this.cache.delete(id);
  }

  close(): void {
    this.storageProvider.close();
    this.cache.clear();
    this.loaded = false;
  }
}
