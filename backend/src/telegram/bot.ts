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

export async function registerBotCommands(): Promise<void> {
  const b = getBot();
  await b.api.setMyCommands([
    { command: 'add',     description: 'Create task — /add <title> [date]' },
    { command: 'tasks',   description: 'List all active (non-done) tasks' },
    { command: 'today',   description: 'List tasks due today' },
    { command: 'overdue', description: 'List overdue tasks' },
    { command: 'task',    description: 'Task detail + actions — /task <id>' },
    { command: 'move',    description: 'Move task — /move <id> <todo|in-progress|done>' },
    { command: 'note',    description: 'Save a scratchpad note — /note <text>' },
    { command: 'notes',   description: 'List all scratchpad notes' },
    { command: 'delnote', description: 'Delete a scratchpad note — /delnote <id>' },
    { command: 'help',    description: 'Show command reference' },
  ]);
  console.log('Telegram bot commands registered');
}
