import { getBot, registerWebhook, registerBotCommands } from '../../src/telegram/bot';

describe('Telegram bot module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws error in getBot if TELEGRAM_BOT_TOKEN is not set', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(() => getBot()).toThrow('TELEGRAM_BOT_TOKEN not set');
  });

  it('instantiates bot if TELEGRAM_BOT_TOKEN is set', () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const bot = getBot();
    expect(bot).toBeDefined();
    expect(bot.token).toBe('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
  });

  it('registerWebhook returns early if TELEGRAM_WEBHOOK_URL is not set', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    delete process.env.TELEGRAM_WEBHOOK_URL;
    const bot = getBot();
    const setWebhookSpy = jest.spyOn(bot.api, 'setWebhook').mockResolvedValue(true as any);

    await registerWebhook();
    expect(setWebhookSpy).not.toHaveBeenCalled();
  });

  it('registerWebhook calls setWebhook with url and secret if configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    process.env.TELEGRAM_WEBHOOK_URL = 'https://example.com/api/webhooks/telegram';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'mysecret';

    const bot = getBot();
    const setWebhookSpy = jest.spyOn(bot.api, 'setWebhook').mockResolvedValue(true as any);

    await registerWebhook();
    expect(setWebhookSpy).toHaveBeenCalledWith('https://example.com/api/webhooks/telegram', {
      secret_token: 'mysecret',
    });
  });

  it('registerBotCommands calls setMyCommands on bot API', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    const bot = getBot();
    const setMyCommandsSpy = jest.spyOn(bot.api, 'setMyCommands').mockResolvedValue(true as any);

    await registerBotCommands();
    expect(setMyCommandsSpy).toHaveBeenCalled();
  });
});
