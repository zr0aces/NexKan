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

function loadSent(): Record<string, boolean> {
  try {
    return JSON.parse(fs.readFileSync(getNotificationsFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveSent(sent: Record<string, boolean>): void {
  const filePath = getNotificationsFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(sent, null, 2));
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function checkAndNotify(): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('TELEGRAM_CHAT_ID not set — notifications skipped');
    return;
  }

  const tasks = await readAll();
  const sent = loadSent();
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
      if (!sent[key]) {
        pending.push({ key, send: () => bot.api.sendMessage(
          chatId,
          `⚠️ Overdue: ${task.title} (${task.id})\nDue: ${formatDate(task.due_date!)} · Status: ${task.status}`,
          { reply_markup: keyboard }
        ).then(() => {}) });
      }
      continue;
    }

    if (isEqual(dueDate, today)) {
      const key = `${task.id}:due-today:${task.due_date}`;
      if (!sent[key]) {
        pending.push({ key, send: () => bot.api.sendMessage(
          chatId,
          `🔔 Due today: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        ).then(() => {}) });
      }
      continue;
    }

    if (isEqual(dueDate, tomorrow)) {
      const key = `${task.id}:due-tomorrow:${task.due_date}`;
      if (!sent[key]) {
        pending.push({ key, send: () => bot.api.sendMessage(
          chatId,
          `📅 Due tomorrow: ${task.title} (${task.id})\nStatus: ${task.status}`,
          { reply_markup: keyboard }
        ).then(() => {}) });
      }
    }
  }

  if (pending.length === 0) return;

  const results = await Promise.allSettled(pending.map(p => p.send()));
  let dirty = false;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent[pending[i].key] = true;
      dirty = true;
    } else {
      console.error(`Failed to send notification for key ${pending[i].key}:`, result.reason);
    }
  });

  if (dirty) {
    try {
      saveSent(sent);
    } catch (e) {
      console.error('Failed to persist notification state:', e);
    }
  }
}
