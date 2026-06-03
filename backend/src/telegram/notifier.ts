import * as fs from 'fs';
import * as path from 'path';
import { readAll } from '../tasks/store';
import { getBot } from './bot';
import { buildTaskKeyboard } from './utils';
import { startOfDay, isBefore, isEqual, addDays, format } from 'date-fns';
import { parseLocalDate, formatDate } from '@nexkan/shared';

function getNotificationsFile(): string {
  return process.env.NOTIFICATIONS_FILE || './data/notifications-sent.json';
}

async function loadSent(): Promise<Record<string, boolean>> {
  try {
    return JSON.parse(await fs.promises.readFile(getNotificationsFile(), 'utf-8'));
  } catch {
    return {};
  }
}

async function saveSent(sent: Record<string, boolean>): Promise<void> {
  const filePath = getNotificationsFile();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(sent, null, 2));
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function pruneSent(sent: Record<string, boolean>, activeTaskIds: string[]): Record<string, boolean> {
  const pruned: Record<string, boolean> = {};
  const today = startOfDay(new Date());
  const activeIdsSet = new Set(activeTaskIds);
  const currentTodayStr = todayStr();

  for (const [key, val] of Object.entries(sent)) {
    const parts = key.split(':');
    if (parts.length < 3) continue;
    const taskId = parts[0];
    const type = parts[1];
    const dateStr = parts[2];

    if (!activeIdsSet.has(taskId)) continue;

    if (type === 'overdue' && dateStr !== currentTodayStr) continue;

    try {
      const dateVal = startOfDay(parseLocalDate(dateStr));
      if (dateVal < today) continue;
    } catch {
      // Keep if parsing fails for safety
    }

    pruned[key] = val;
  }
  return pruned;
}

export async function checkAndNotify(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('TELEGRAM_CHAT_ID not set — notifications skipped');
    return;
  }

  const tasks = await readAll();
  const sent = await loadSent();
  const activeTaskIds = tasks.filter(t => t.status !== 'done').map(t => t.id);
  const pruned = pruneSent(sent, activeTaskIds);
  const initialKeyCount = Object.keys(sent).length;
  const prunedKeyCount = Object.keys(pruned).length;
  let dirty = initialKeyCount !== prunedKeyCount;

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const bot = getBot();

  type Pending = { key: string; send: () => Promise<void> };
  const pending: Pending[] = [];

  for (const task of tasks) {
    if (task.status === 'done' || !task.due_date) continue;

    const dueDate = startOfDay(parseLocalDate(task.due_date));
    const keyboard = buildTaskKeyboard(task.id);

    if (isBefore(dueDate, today)) {
      const key = `${task.id}:overdue:${todayStr()}`;
      if (!pruned[key]) {
        pending.push({ key, send: async () => { await bot.api.sendMessage(
          chatId,
          `⚠️ Overdue: ${task.title} (${task.id})\nDue: ${formatDate(task.due_date!)} · Status: ${task.status}`,
          { reply_markup: keyboard }
        ); } });
      }
      continue;
    }

    if (isEqual(dueDate, today)) {
      const key = `${task.id}:due-today:${task.due_date}`;
      if (!pruned[key]) {
        pending.push({ key, send: async () => { await bot.api.sendMessage(
          chatId,
          `🔔 Due today: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        ); } });
      }
      continue;
    }

    if (isEqual(dueDate, tomorrow)) {
      const key = `${task.id}:due-tomorrow:${task.due_date}`;
      if (!pruned[key]) {
        pending.push({ key, send: async () => { await bot.api.sendMessage(
          chatId,
          `📅 Due tomorrow: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        ); } });
      }
    }
  }

  if (pending.length > 0) {
    const results = await Promise.allSettled(pending.map(p => p.send()));
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        pruned[pending[i].key] = true;
        dirty = true;
      } else {
        console.error(`Failed to send notification for key ${pending[i].key}:`, result.reason);
      }
    });
  }

  if (dirty) {
    try {
      await saveSent(pruned);
    } catch (e) {
      console.error('Failed to persist notification state:', e);
    }
  }
}
