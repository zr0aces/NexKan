import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { parseTask, serializeTask } from './parser';
import { Task, TaskStatus, TaskFilters, CreateTaskInput, UpdateTaskInput, parseLocalDate, requiresDueDate, isOverdue } from '@nexkan/shared';
import { startOfDay, isEqual, addDays } from 'date-fns';

function getDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data', 'tasks');
}

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
  filePath: string;
}

async function readAllEntries(): Promise<TaskEntry[]> {
  const dir = getDir();
  try {
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md'));
    const entries = await Promise.all(
      files.map(async filename => {
        const filePath = path.join(dir, filename);
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          return { task: parseTask(content, filename), filePath };
        } catch {
          console.error(`Skipping corrupted task file: ${filename}`);
          return null;
        }
      })
    );
    return entries.filter((e): e is TaskEntry => e !== null);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function readAllFiles(): Promise<Task[]> {
  return (await readAllEntries()).map(e => e.task);
}

async function findEntry(id: string): Promise<TaskEntry | null> {
  const dir = getDir();
  try {
    const files = (await fs.promises.readdir(dir)).filter(
      f => f.startsWith(`${id}-`) && f.endsWith('.md')
    );
    if (files.length === 0) return null;
    const filePath = path.join(dir, files[0]);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { task: parseTask(content, files[0]), filePath };
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function todayDate(): Date {
  return startOfDay(new Date());
}

function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks;
  const todayD = todayDate();
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

function applySorting(tasks: Task[], sort?: string): Task[] {
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

export async function readAll(filters: TaskFilters = {}): Promise<Task[]> {
  const tasks = await readAllFiles();
  const filtered = applyFilters(tasks, filters);
  return applySorting(filtered, filters.sort);
}

export async function readById(id: string): Promise<Task | null> {
  return (await findEntry(id))?.task ?? null;
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Task ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const dir = getDir();
  await fs.promises.mkdir(dir, { recursive: true });

  const id = nanoid(8);
  const status = input.status ?? 'todo';
  if (requiresDueDate(status) && !input.due_date) {
    throw new Error(`due_date is required when creating a task with status ${status}`);
  }
  const now = new Date().toISOString();

  const allTasks = await readAllFiles();
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
  await fs.promises.writeFile(path.join(dir, filename), serializeTask(task));
  return task;
}

export async function update(id: string, input: UpdateTaskInput): Promise<Task> {
  const entry = await findEntry(id);
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

  await fs.promises.writeFile(filePath, serializeTask(updated));
  return updated;
}

export async function updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
  const entries = await readAllEntries();
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

  await fs.promises.writeFile(filePath, serializeTask(updated));
  return updated;
}

export async function updateOrder(id: string, position: number): Promise<Task> {
  const entries = await readAllEntries();
  const entry = entries.find(e => e.task.id === id);
  if (!entry) throw new NotFoundError(id);

  const inColumn = entries
    .filter(e => e.task.status === entry.task.status)
    .sort((a, b) => a.task.sort_order - b.task.sort_order);

  const others = inColumn.filter(e => e.task.id !== id);
  others.splice(position, 0, entry);

  // Snapshot original tasks for rollback; derive new sort_order from insertion index
  const snapshots = others.map((e, i) => ({
    filePath: e.filePath,
    original: e.task,
    updated: { ...e.task, sort_order: i + 1, updated_at: new Date().toISOString() },
  }));

  try {
    await Promise.all(
      snapshots.map(snap => fs.promises.writeFile(snap.filePath, serializeTask(snap.updated)))
    );
  } catch (err) {
    await Promise.allSettled(
      snapshots.map(snap => fs.promises.writeFile(snap.filePath, serializeTask(snap.original)))
    );
    throw err;
  }

  const updated = await readById(id);
  if (!updated) throw new NotFoundError(id);
  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  const entry = await findEntry(id);
  if (!entry) throw new NotFoundError(id);
  await fs.promises.unlink(entry.filePath);
}
