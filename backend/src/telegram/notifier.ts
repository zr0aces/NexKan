import * as fs from 'fs';
import * as path from 'path';
import { readAll } from '../tasks/store';
import { getBot } from './bot';
import { startOfDay, parseISO, isBefore, isEqual, addDays, format } from 'date-fns';
import { InlineKeyboard } from 'grammy';

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

  try {
    for (const task of tasks) {
      if (task.status === 'done' || !task.due_date) continue;

      const dueDate = startOfDay(parseISO(task.due_date));
      const keyboard = new InlineKeyboard().text('View Task', `view:${task.id}`);

      if (isBefore(dueDate, today)) {
        const key = `${task.id}:overdue:${todayStr()}`;
        if (!sent[key]) {
          await bot.api.sendMessage(
            chatId,
            `⚠️ Overdue: ${task.title} (${task.id})\nDue: ${task.due_date} · Status: ${task.status}`,
            { reply_markup: keyboard }
          );
          sent[key] = true;
        }
        continue;
      }

      if (isEqual(dueDate, today)) {
        const key = `${task.id}:due-today:${task.due_date}`;
        if (!sent[key]) {
          await bot.api.sendMessage(
            chatId,
            `🔔 Due today: ${task.title} (${task.id})\nStatus: ${task.status}`,
            { reply_markup: keyboard }
          );
          sent[key] = true;
        }
        continue;
      }

      if (isEqual(dueDate, tomorrow)) {
        const key = `${task.id}:due-tomorrow:${task.due_date}`;
        if (!sent[key]) {
          await bot.api.sendMessage(
            chatId,
            `📅 Due tomorrow: ${task.title} (${task.id})\nStatus: ${task.status}`,
            { reply_markup: keyboard }
          );
          sent[key] = true;
        }
      }
    }
  } finally {
    try {
      saveSent(sent);
    } catch (e) {
      console.error('Failed to persist notification state:', e);
    }
  }
}
