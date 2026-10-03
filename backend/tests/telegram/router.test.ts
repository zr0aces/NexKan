import request from 'supertest';
import fastify, { FastifyInstance } from 'fastify';
import { telegramRoutes, setupBotCommands } from '../../src/telegram/router';
import { TaskStore } from '../../src/tasks/store';
import { NoteStore } from '../../src/scratchpad/store';
import { InMemoryStorageProvider } from '../../src/storage/inMemory';
import { getBot } from '../../src/telegram/bot';

describe('Telegram router and bot setup', () => {
  let taskStore: TaskStore;
  let noteStore: NoteStore;
  let app: FastifyInstance;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      TELEGRAM_CHAT_ID: '987654321',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      CRON_SECRET: 'test-cron-secret',
    };
    taskStore = new TaskStore(new InMemoryStorageProvider());
    noteStore = new NoteStore(new InMemoryStorageProvider());

    const bot = getBot();
    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: 'NexKanBot',
      username: 'nexkan_test_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as any;

    app = fastify();
    app.register(telegramRoutes, { prefix: '/api', taskStore, noteStore });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    taskStore.close();
    noteStore.close();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST /api/webhooks/telegram', () => {
    it('returns 401 when webhook secret token header does not match', async () => {
      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({ update_id: 1 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when webhook secret token is unset', async () => {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({ update_id: 1 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('processes webhook payload with valid secret token', async () => {
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockResolvedValue();

      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({ update_id: 100 });

      expect(res.status).toBe(200);
    });

    it('catches webhook errors, notifies admin chat and returns 200', async () => {
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockRejectedValue(new Error('Webhook failure'));
      const sendSpy = jest.spyOn(bot.api, 'sendMessage').mockResolvedValue({} as any);

      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({ update_id: 101 });

      expect(res.status).toBe(200);
      expect(sendSpy).toHaveBeenCalledWith(
        '987654321',
        expect.stringContaining('Webhook Delivery Error'),
        expect.any(Object)
      );
    });

    it('accepts 14 KiB webhook update with 200', async () => {
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockResolvedValue();

      const largeText = 'ก'.repeat(4096);
      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({
          update_id: 200,
          message: {
            message_id: 1,
            date: 1700000000,
            chat: { id: 987654321, type: 'private' },
            text: largeText,
          },
        });

      expect(res.status).toBe(200);
    });

    it('rejects 2 MiB webhook update with 413', async () => {
      const hugeText = 'a'.repeat(2 * 1024 * 1024);
      const res = await request(app.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({
          update_id: 201,
          message: {
            message_id: 1,
            date: 1700000000,
            chat: { id: 987654321, type: 'private' },
            text: hugeText,
          },
        });

      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/telegram/status', () => {
    it('returns bot info on success', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'getMe').mockResolvedValue({
        id: 123456,
        is_bot: true,
        first_name: 'NexKanBot',
        username: 'nexkan_test_bot',
      } as any);

      const res = await request(app.server).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, bot: 'nexkan_test_bot' });
    });

    it('returns 503 if bot is unreachable', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'getMe').mockRejectedValue(new Error('Network error'));

      const res = await request(app.server).get('/api/telegram/status');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ ok: false, error: 'Bot unreachable' });
    });
  });

  describe('POST /api/telegram/test', () => {
    it('sends test notification if TELEGRAM_CHAT_ID is configured', async () => {
      const bot = getBot();
      const sendSpy = jest.spyOn(bot.api, 'sendMessage').mockResolvedValue({} as any);

      const res = await request(app.server).post('/api/telegram/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(sendSpy).toHaveBeenCalledWith('987654321', '🧪 NexKan test notification');
    });

    it('returns 400 if TELEGRAM_CHAT_ID is missing', async () => {
      delete process.env.TELEGRAM_CHAT_ID;
      const res = await request(app.server).post('/api/telegram/test');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('TELEGRAM_CHAT_ID not set');
    });

    it('returns 500 if sendMessage fails', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'sendMessage').mockRejectedValue(new Error('Send error'));

      const res = await request(app.server).post('/api/telegram/test');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to send test message');
    });
  });

  describe('POST /api/notifications/check', () => {
    it('executes checkAndNotify successfully with cron secret', async () => {
      const res = await request(app.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'test-cron-secret');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 401 without valid cron secret', async () => {
      const res = await request(app.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'wrong-secret');

      expect(res.status).toBe(401);
    });

    it('returns 401 when cron secret is unset', async () => {
      delete process.env.CRON_SECRET;

      const res = await request(app.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'any');

      expect(res.status).toBe(401);
    });
  });

  describe('setupBotCommands', () => {
    it('configures handlers and catches errors', () => {
      expect(() => setupBotCommands(taskStore, noteStore)).not.toThrow();
    });
  });
});
