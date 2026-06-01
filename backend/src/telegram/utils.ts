import type { Context } from 'grammy';

export function escapeMd(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}

/**
 * Returns true when the incoming update originates from the authorised chat.
 * TELEGRAM_CHAT_ID must match the sender's chat/user ID exactly.
 * If TELEGRAM_CHAT_ID is not set every chat is accepted (dev/unset mode);
 * a warning is logged so operators notice the misconfiguration in production.
 */
export function isAuthorizedChat(ctx: Context): boolean {
  const allowedId = process.env.TELEGRAM_CHAT_ID;
  if (!allowedId) {
    console.warn('TELEGRAM_CHAT_ID not set — accepting all incoming Telegram messages');
    return true;
  }
  const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? '');
  return chatId === allowedId;
}
