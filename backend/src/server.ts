import app from './app';
import { registerWebhook } from './telegram/bot';
import { setupBotCommands } from './telegram/router';

const port = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    setupBotCommands();
    await registerWebhook();
  } else {
    console.warn('TELEGRAM_BOT_TOKEN not set — Telegram features disabled');
  }

  app.listen(port, () => {
    console.log(`NexKan backend running on port ${port}`);
  });
}

start().catch(console.error);
