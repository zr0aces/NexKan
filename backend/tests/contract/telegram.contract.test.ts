import request from 'supertest';
import { createContractTestContext, ContractTestContext } from './server';
import { getBot } from '../../src/telegram/bot';
import * as notifier from '../../src/telegram/notifier';

describe('Telegram Contract Tests (Rows 13-16)', () => {
  let ctx: ContractTestContext;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      TELEGRAM_CHAT_ID: '987654321',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      CRON_SECRET: 'test-cron-secret',
    };
    ctx = await createContractTestContext();
  });

  afterEach(async () => {
    await ctx.close();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // Row 13: POST /api/webhooks/telegram
  describe('Row 13: POST /api/webhooks/telegram', () => {
    it('returns 401 {error: "Unauthorized"} when secret header is missing or wrong', async () => {
      const resMissing = await request(ctx.server)
        .post('/api/webhooks/telegram')
        .send({ update_id: 1 });
      expect(resMissing.status).toBe(401);
      expect(resMissing.body).toEqual({ error: 'Unauthorized' });

      const resWrong = await request(ctx.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({ update_id: 1 });
      expect(resWrong.status).toBe(401);
      expect(resWrong.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 200 when webhook secret is unset on Express (pre-D2 fail-open)', async () => {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockResolvedValue();

      const res = await request(ctx.server)
        .post('/api/webhooks/telegram')
        .send({ update_id: 100 });

      // On Express today, unset secret passes
      expect(res.status).toBe(200);
    });

    it('returns 200 on valid secret token even when update handler throws', async () => {
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockRejectedValue(new Error('Handler failure'));
      jest.spyOn(bot.api, 'sendMessage').mockResolvedValue({} as any);

      const res = await request(ctx.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send({ update_id: 101 });

      expect(res.status).toBe(200);
    });
  });

  // Row 14: POST /api/notifications/check
  describe('Row 14: POST /api/notifications/check', () => {
    it('returns 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'any');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when x-cron-secret header does not match', async () => {
      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'wrong-cron-secret');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 200 {ok: true} with valid cron secret', async () => {
      jest.spyOn(notifier, 'checkAndNotify').mockResolvedValue();

      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'test-cron-secret');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 500 {error: "Notification check failed"} when notifier fails', async () => {
      jest.spyOn(notifier, 'checkAndNotify').mockRejectedValue(new Error('notifier explosion'));

      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'test-cron-secret');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Notification check failed' });
    });
  });

  // Row 15: GET /api/telegram/status
  describe('Row 15: GET /api/telegram/status', () => {
    it('returns 200 {ok: true, bot: username} when getMe succeeds', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'getMe').mockResolvedValue({
        id: 123456,
        is_bot: true,
        first_name: 'NexKanBot',
        username: 'nexkan_test_bot',
      } as any);

      const res = await request(ctx.server).get('/api/telegram/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, bot: 'nexkan_test_bot' });
    });

    it('returns 503 {ok: false, error: "Bot unreachable"} when getMe fails', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'getMe').mockRejectedValue(new Error('Network offline'));

      const res = await request(ctx.server).get('/api/telegram/status');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ ok: false, error: 'Bot unreachable' });
    });
  });

  // Row 16: POST /api/telegram/test
  describe('Row 16: POST /api/telegram/test', () => {
    it('returns 400 if TELEGRAM_CHAT_ID is missing', async () => {
      delete process.env.TELEGRAM_CHAT_ID;
      const res = await request(ctx.server).post('/api/telegram/test');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'TELEGRAM_CHAT_ID not set' });
    });

    it('returns 200 {ok: true} when test message sent successfully', async () => {
      const bot = getBot();
      const sendSpy = jest.spyOn(bot.api, 'sendMessage').mockResolvedValue({} as any);

      const res = await request(ctx.server).post('/api/telegram/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(sendSpy).toHaveBeenCalledWith('987654321', '🧪 NexKan test notification');
    });

    it('returns 500 when sendMessage fails', async () => {
      const bot = getBot();
      jest.spyOn(bot.api, 'sendMessage').mockRejectedValue(new Error('Telegram down'));

      const res = await request(ctx.server).post('/api/telegram/test');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to send test message' });
    });
  });
});
