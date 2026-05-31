import * as fs from 'fs';
import * as path from 'path';
import { parseTask, serializeTask } from './parser';
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { startOfDay, parseISO, isBefore, isEqual, addDays, format } from 'date-fns';

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
  return files.map(filename => {
    const content = fs.readFileSync(path.join(dir, filename), 'utf-8');
    return parseTask(content, filename);
  });
}

function todayDate(): Date {
  return startOfDay(new Date());
}

function parseDateStr(dateStr: string): Date {
  return startOfDay(parseISO(dateStr));
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
    case 'due_date:asc':
      return sorted.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    case 'sort_order:asc':
    default:
      return sorted.sort((a, b) => a.sort_order - b.sort_order);
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
