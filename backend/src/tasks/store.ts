import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { parseTask, serializeTask } from './parser';
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { startOfDay, isBefore, isEqual, addDays, format } from 'date-fns';
import { parseLocalDate } from '../lib/date';

function getDataDir(): string {
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

async function readAllFiles(): Promise<Task[]> {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.flatMap(filename => {
    try {
      const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
      return [parseTask(content, filename)];
    } catch {
      console.error(`Skipping corrupted task file: ${filename}`);
      return [];
    }
  });
}

function todayDate(): Date {
  return startOfDay(new Date());
}

function parseDateStr(dateStr: string): Date {
  return startOfDay(parseLocalDate(dateStr));
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
    result = result.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return isBefore(parseDateStr(t.due_date), todayD);
    });
  }

  if (filters.due_today) {
    result = result.filter(t => {
      if (!t.due_date) return false;
      return isEqual(parseDateStr(t.due_date), todayD);
    });
  }

  if (filters.due_tomorrow) {
    result = result.filter(t => {
      if (!t.due_date) return false;
      return isEqual(parseDateStr(t.due_date), tomorrowD);
    });
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
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (files.length === 0) return null;
  const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
  return parseTask(content, files[0]);
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Task ${id} not found`);
    this.name = 'NotFoundError';
  }
}

async function findFilePath(id: string): Promise<string> {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) throw new NotFoundError(id);
  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (files.length === 0) throw new NotFoundError(id);
  return path.join(dir, files[0]);
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });

  const id = nanoid(8);
  const status = input.status ?? 'todo';
  const requiresDueDate = status === 'todo' || status === 'in-progress';
  if (requiresDueDate && !input.due_date) {
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

  const slug = toSlug(input.title);
  const filename = `${id}-${slug}.md`;
  fs.writeFileSync(path.join(dir, filename), serializeTask(task));
  return task;
}

export async function update(id: string, input: UpdateTaskInput): Promise<Task> {
  const filePath = await findFilePath(id);
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = parseTask(content, path.basename(filePath));

  const updated: Task = {
    ...task,
    updated_at: new Date().toISOString(),
  };

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

  fs.writeFileSync(filePath, serializeTask(updated));
  return updated;
}

export async function updateStatus(id: string, status: string, due_date?: string): Promise<Task> {
  const filePath = await findFilePath(id);
  const content = fs.readFileSync(filePath, 'utf-8');
  const task = parseTask(content, path.basename(filePath));

  const requiresDueDate = status === 'todo' || status === 'in-progress';
  const effectiveDueDate = due_date ?? task.due_date;
  if (requiresDueDate && !effectiveDueDate) {
    throw new Error(`due_date is required when moving to ${status}`);
  }

  const allTasks = await readAllFiles();
  const inTargetColumn = allTasks.filter(t => t.status === status && t.id !== id);
  const sortOrder = inTargetColumn.length > 0
    ? Math.max(...inTargetColumn.map(t => t.sort_order)) + 1
    : 1;

  const updated: Task = {
    ...task,
    status: status as Task['status'],
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
    due_date: due_date ?? task.due_date,
  };

  fs.writeFileSync(filePath, serializeTask(updated));
  return updated;
}

export async function updateOrder(id: string, position: number): Promise<Task> {
  const dir = getDataDir();
  const task = await readById(id);
  if (!task) throw new NotFoundError(id);

  const allTasks = await readAllFiles();
  const inColumn = allTasks
    .filter(t => t.status === task.status)
    .sort((a, b) => a.sort_order - b.sort_order);

  const others = inColumn.filter(t => t.id !== id);
  others.splice(position, 0, task);

  // Single readdirSync to build id→path map — avoids N×readdirSync in the loop
  const dirFiles = fs.readdirSync(dir);
  function pathFor(taskId: string): string {
    const file = dirFiles.find(f => f.startsWith(`${taskId}-`) && f.endsWith('.md'));
    if (!file) throw new NotFoundError(taskId);
    return path.join(dir, file);
  }

  const snapshots: Array<{ path: string; content: string }> = [];
  for (const t of others) {
    const fp = pathFor(t.id);
    snapshots.push({ path: fp, content: fs.readFileSync(fp, 'utf-8') });
  }

  try {
    for (let i = 0; i < others.length; i++) {
      const snap = snapshots[i];
      const parsed = parseTask(snap.content, path.basename(snap.path));
      parsed.sort_order = i + 1;
      parsed.updated_at = new Date().toISOString();
      fs.writeFileSync(snap.path, serializeTask(parsed));
    }
  } catch (err) {
    // Restore originals
    for (const snap of snapshots) {
      try { fs.writeFileSync(snap.path, snap.content); } catch { /* best effort */ }
    }
    throw err;
  }

  return (await readById(id))!;
}

export async function deleteTask(id: string): Promise<void> {
  const filePath = await findFilePath(id);
  fs.unlinkSync(filePath);
}
