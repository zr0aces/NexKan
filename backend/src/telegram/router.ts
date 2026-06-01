import { Router, Request, Response } from 'express';
import { webhookAuth, cronAuth } from './middleware';
import { getBot } from './bot';
import { checkAndNotify } from './notifier';
import { handleAdd } from './commands/add';
import { handleTasks } from './commands/tasks';
import { handleToday } from './commands/today';
import { handleOverdue } from './commands/overdue';
import { handleTask } from './commands/task';
import { handleMove } from './commands/move';
import { handleHelp } from './commands/help';
import { handleNote } from './commands/note';
import { handleNotes } from './commands/notes';
import { handleDelnote } from './commands/delnote';
import { handleCallback } from './callbacks';
import { webhookCallback } from 'grammy';

export const telegramRouter = Router();

telegramRouter.post('/webhooks/telegram', webhookAuth, async (req: Request, res: Response) => {
  try {
    await webhookCallback(getBot(), 'express')(req, res);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

telegramRouter.post('/notifications/check', cronAuth, async (_req: Request, res: Response) => {
  try {
    await checkAndNotify();
    res.json({ ok: true });
  } catch (err) {
    console.error('Notification check error:', err);
    res.status(500).json({ error: 'Notification check failed' });
  }
});

telegramRouter.get('/telegram/status', async (_req: Request, res: Response) => {
  try {
    const bot = getBot();
    const me = await bot.api.getMe();
    res.json({ ok: true, bot: me.username });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Bot unreachable' });
  }
});

telegramRouter.post('/telegram/test', async (_req: Request, res: Response) => {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return void res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
    await getBot().api.sendMessage(chatId, '🧪 NexKan test notification');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

export function setupBotCommands(): void {
  const bot = getBot();
  bot.command('add', handleAdd);
  bot.command('tasks', handleTasks);
  bot.command('today', handleToday);
  bot.command('overdue', handleOverdue);
  bot.command('task', handleTask);
  bot.command('move', handleMove);
  bot.command('help', handleHelp);
  bot.command('note', handleNote);
  bot.command('notes', handleNotes);
  bot.command('delnote', handleDelnote);
  bot.on('callback_query:data', handleCallback);
}
