import type { Context } from 'grammy';
import { TelegramPresenter, escapeMd } from './presenter';

export { escapeMd };

export function isAuthorizedChat(ctx: Context): boolean {
  const allowedId = process.env.TELEGRAM_CHAT_ID;
  if (!allowedId) {
    console.warn('TELEGRAM_CHAT_ID not set — accepting all incoming Telegram messages');
    return true;
  }
  const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? '');
  return chatId === allowedId;
}

export const buildTaskKeyboard = TelegramPresenter.buildTaskKeyboard.bind(TelegramPresenter);
