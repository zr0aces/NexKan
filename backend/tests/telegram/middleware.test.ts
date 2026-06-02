import request from 'supertest';
import express from 'express';
import { webhookAuth, cronAuth } from '../../src/telegram/middleware';

function makeApp(middleware: any) {
  const app = express();
  app.use(middleware);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('webhookAuth', () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
  });

  it('passes through when no secret is configured', async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 401 when header is missing', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when header is wrong', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'wrong');
    expect(res.status).toBe(401);
  });

  it('calls next when header matches', async () => {
    const app = makeApp(webhookAuth);
    const res = await request(app).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'test-secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('cronAuth', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
  });

  it('returns 401 when header is missing', async () => {
    const app = makeApp(cronAuth);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('calls next when X-Cron-Secret matches', async () => {
    const app = makeApp(cronAuth);
    const res = await request(app).get('/test').set('X-Cron-Secret', 'cron-secret');
    expect(res.status).toBe(200);
  });
});
