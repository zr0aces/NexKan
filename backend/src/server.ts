import app, { defaultTaskStore, defaultNoteStore } from './app';
import { registerWebhook, registerBotCommands } from './telegram/bot';
import { setupBotCommands } from './telegram/router';

const port = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.error(
        'Telegram misconfigured: TELEGRAM_BOT_TOKEN is set but TELEGRAM_WEBHOOK_SECRET is missing. Set it or unset TELEGRAM_BOT_TOKEN.'
      );
      process.exit(1);
    }
    if (!process.env.TELEGRAM_CHAT_ID) {
      console.error(
        'Telegram misconfigured: TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing. Set it or unset TELEGRAM_BOT_TOKEN.'
      );
      process.exit(1);
    }
    try {
      setupBotCommands(defaultTaskStore, defaultNoteStore);
      await registerWebhook();
      await registerBotCommands();
    } catch (err) {
      console.error('Failed to initialize Telegram integration:', err);
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not set — Telegram features disabled');
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    const forceExitTimer = setTimeout(() => {
      console.error('Forced shutdown after 10s timeout');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      await app.close();
      console.log('NexKan backend closed cleanly');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`NexKan backend running on port ${port}`);
  });
}

start().catch(console.error);
