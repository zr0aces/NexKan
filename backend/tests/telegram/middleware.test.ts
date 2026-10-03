import request from 'supertest';
import fastify, { FastifyInstance } from 'fastify';
import { webhookAuth, cronAuth } from '../../src/telegram/middleware';

async function makeApp(hook: any): Promise<FastifyInstance> {
  const app = fastify();
  app.addHook('onRequest', hook);
  app.get('/test', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('webhookAuth', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns 401 when no secret is configured', async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    app = await makeApp(webhookAuth);
    const res = await request(app.server).get('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when header is missing', async () => {
    app = await makeApp(webhookAuth);
    const res = await request(app.server).get('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when header is wrong', async () => {
    app = await makeApp(webhookAuth);
    const res = await request(app.server).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'wrong');
    expect(res.status).toBe(401);
  });

  it('allows request when header matches', async () => {
    app = await makeApp(webhookAuth);
    const res = await request(app.server).get('/test').set('X-Telegram-Bot-Api-Secret-Token', 'test-secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('cronAuth', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns 401 when header is missing', async () => {
    app = await makeApp(cronAuth);
    const res = await request(app.server).get('/test');
    expect(res.status).toBe(401);
  });

  it('allows request when X-Cron-Secret matches', async () => {
    app = await makeApp(cronAuth);
    const res = await request(app.server).get('/test').set('X-Cron-Secret', 'cron-secret');
    expect(res.status).toBe(200);
  });
});
