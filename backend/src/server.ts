import app from './app';
import { registerWebhook, registerBotCommands } from './telegram/bot';
import { setupBotCommands } from './telegram/router';

const port = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      setupBotCommands();
      await registerWebhook();
      await registerBotCommands();
    } catch (err) {
      console.error('Failed to initialize Telegram integration:', err);
    }
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not set — Telegram features disabled');
  }

  app.listen(port, () => {
    console.log(`NexKan backend running on port ${port}`);
  });
}

start().catch(console.error);
