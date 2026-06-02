import { Bot } from 'grammy';

let bot: Bot | null = null;

export function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
    bot = new Bot(token);
  }
  return bot;
}

export async function registerWebhook(): Promise<void> {
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!url) {
    console.warn('TELEGRAM_WEBHOOK_URL not set — webhook not registered');
    return;
  }
  const b = getBot();
  const opts = secret ? { secret_token: secret } : {};
  if (!secret) {
    console.warn('TELEGRAM_WEBHOOK_SECRET not set — webhook registered without secret token (less secure)');
  }
  await b.api.setWebhook(url, opts);
  console.log(`Telegram webhook registered: ${url}`);
}
