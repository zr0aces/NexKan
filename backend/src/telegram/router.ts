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
import { isAuthorizedChat } from './utils';
import { TaskStore } from '../tasks/store';
import { NoteStore } from '../scratchpad/store';

export function createTelegramRouter(taskStore: TaskStore, noteStore: NoteStore): Router {
  const router = Router();

  router.post('/webhooks/telegram', webhookAuth, async (req: Request, res: Response) => {
    try {
      await webhookCallback(getBot(), 'express')(req, res);
    } catch (err) {
      console.error('Webhook error:', err);
      try {
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (chatId) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await getBot().api.sendMessage(
            chatId,
            `⚠️ **Webhook Delivery Error:**\n\`${errMsg}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      } catch (sendErr) {
        console.error('Failed to send webhook error notification to Telegram:', sendErr);
      }
      if (!res.headersSent) res.sendStatus(200);
    }
  });

  router.post('/notifications/check', cronAuth, async (_req: Request, res: Response) => {
    try {
      await checkAndNotify(taskStore);
      res.json({ ok: true });
    } catch (err) {
      console.error('Notification check error:', err);
      res.status(500).json({ error: 'Notification check failed' });
    }
  });

  router.get('/telegram/status', async (_req: Request, res: Response) => {
    try {
      const bot = getBot();
      const me = await bot.api.getMe();
      res.json({ ok: true, bot: me.username });
    } catch (err) {
      res.status(503).json({ ok: false, error: 'Bot unreachable' });
    }
  });

  router.post('/telegram/test', async (_req: Request, res: Response) => {
    try {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!chatId) return void res.status(400).json({ error: 'TELEGRAM_CHAT_ID not set' });
      await getBot().api.sendMessage(chatId, '🧪 NexKan test notification');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send test message' });
    }
  });

  return router;
}

export function setupBotCommands(taskStore: TaskStore, noteStore: NoteStore): void {
  const bot = getBot();

  bot.catch(async (err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
    try {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const errMsg = err.error instanceof Error ? err.error.message : String(err.error);
        await err.ctx.api.sendMessage(
          chatId,
          `⚠️ **NexKan Error:**\n\`${errMsg}\``,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    } catch (sendErr) {
      console.error('Failed to send error notification to Telegram:', sendErr);
    }
  });

  // Centralized authorization middleware
  bot.use(async (ctx, next) => {
    if (!isAuthorizedChat(ctx)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '❌ Unauthorized access.' });
      } else {
        await ctx.reply('❌ Unauthorized access. Please configure TELEGRAM_CHAT_ID.');
      }
      return;
    }
    await next();
  });

  // Start welcome command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      "👋 Welcome to **NexKan**! I am your personal Kanban board assistant.\n\n" +
      "Use /help to see all available commands.",
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('add', (ctx) => handleAdd(ctx, taskStore));
  bot.command('tasks', (ctx) => handleTasks(ctx, taskStore));
  bot.command('today', (ctx) => handleToday(ctx, taskStore));
  bot.command('overdue', (ctx) => handleOverdue(ctx, taskStore));
  bot.command('task', (ctx) => handleTask(ctx, taskStore));
  bot.command('move', (ctx) => handleMove(ctx, taskStore));
  bot.command('help', handleHelp);
  bot.command('note', (ctx) => handleNote(ctx, noteStore));
  bot.command('notes', (ctx) => handleNotes(ctx, noteStore));
  bot.command('delnote', (ctx) => handleDelnote(ctx, noteStore));
  bot.on('callback_query:data', (ctx) => handleCallback(ctx, taskStore));
}
