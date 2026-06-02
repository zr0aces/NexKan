import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';

export function escapeMd(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}

export function isAuthorizedChat(ctx: Context): boolean {
  const allowedId = process.env.TELEGRAM_CHAT_ID;
  if (!allowedId) {
    console.warn('TELEGRAM_CHAT_ID not set — accepting all incoming Telegram messages');
    return true;
  }
  const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? '');
  return chatId === allowedId;
}

export function buildTaskKeyboard(taskId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('▶ Start',      `move:${taskId}:in-progress`)
    .text('✅ Complete',  `move:${taskId}:done`)
    .row()
    .text('📌 Todo',      `move:${taskId}:todo`);
}
