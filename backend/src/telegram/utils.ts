import type { Context } from 'grammy';
import { TelegramPresenter, escapeMd } from './presenter';

export { escapeMd };

export function isAuthorizedChat(ctx: Context): boolean {
  const allowedId = process.env.TELEGRAM_CHAT_ID;
  if (!allowedId) {
    console.error('TELEGRAM_CHAT_ID not set — rejecting incoming Telegram message');
    return false;
  }
  const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? '');
  return chatId === allowedId;
}

export const buildTaskKeyboard = TelegramPresenter.buildTaskKeyboard.bind(TelegramPresenter);
