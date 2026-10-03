import request from 'supertest';
import { createContractTestContext, ContractTestContext, isFastify } from './server';

describe('Differences and Edge Cases Contract Tests (C2-C8, U1, U2)', () => {
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
  });

  // C2: Malformed JSON and oversize body
  describe('C2: Malformed JSON and oversize body format', () => {
    it('handles malformed JSON body', async () => {
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{ malformed json');

      expect(res.status).toBe(400);
      if (isFastify) {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toHaveProperty('error');
      } else {
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('SyntaxError');
      }
    });

    it('handles oversize body (> 10 KiB) on standard routes', async () => {
      const largePayload = JSON.stringify({
        title: 'Large Payload Task',
        description: 'a'.repeat(12 * 1024),
      });

      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
      if (isFastify) {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toHaveProperty('error');
      } else {
        expect(res.headers['content-type']).toMatch(/text\/html/);
      }
    });
  });

  // C3: 404 Unknown route
  describe('C3: Unknown route handling', () => {
    it('handles unknown route with appropriate format', async () => {
      const res = await request(ctx.server).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      if (isFastify) {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toEqual({ error: 'Not found' });
      } else {
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('Cannot GET /api/unknown-endpoint');
      }
    });
  });

  // C4: Case-sensitivity
  describe('C4: Path case sensitivity', () => {
    it('behaves according to framework case-sensitivity rule', async () => {
      const res = await request(ctx.server).get('/API/tasks');
      if (isFastify) {
        expect(res.status).toBe(404);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });

  // C5: Auth before body parsing
  describe('C5: Auth hook before body parsing', () => {
    it('evaluates auth vs body-parsing priority on invalid secret and malformed body', async () => {
      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'wrong-secret')
        .set('Content-Type', 'application/json')
        .send('{ invalid json');

      if (isFastify) {
        // Fastify onRequest auth hook runs before body parsing
        expect(res.status).toBe(401);
      } else {
        // Express global express.json middleware runs before route middleware
        expect(res.status).toBe(400);
      }
    });
  });

  // C6: Content-Type other than application/json
  describe('C6: Non-JSON Content-Type handling', () => {
    it('handles text/plain on JSON-expecting endpoints', async () => {
      const res = await request(ctx.server)
        .post('/api/tasks')
        .set('Content-Type', 'text/plain')
        .send('plain text body');

      if (isFastify) {
        expect(res.status).toBe(415);
      } else {
        expect(res.status).toBe(400);
      }
    });

    it('handles application/x-www-form-urlencoded on cron endpoint (curl -d "" shape)', async () => {
      const res = await request(ctx.server)
        .post('/api/notifications/check')
        .set('x-cron-secret', 'test-cron-secret')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('');

      if (isFastify) {
        expect(res.status).toBe(415);
      } else {
        expect(res.status).toBe(200);
      }
    });
  });

  // C7: ETag and X-Powered-By
  describe('C7: ETag and X-Powered-By headers', () => {
    it('checks presence or absence of framework identity headers', async () => {
      const res = await request(ctx.server).get('/api/tasks');
      if (isFastify) {
        expect(res.headers['x-powered-by']).toBeUndefined();
        expect(res.headers['etag']).toBeUndefined();
      } else {
        expect(res.headers['x-powered-by']).toBe('Express');
        expect(res.headers['etag']).toBeDefined();
      }
    });
  });

  // C8: Path param > 100 characters
  describe('C8: Path parameter length limit', () => {
    it('handles path parameter longer than 100 characters', async () => {
      const longId = 'a'.repeat(105);
      const res = await request(ctx.server).get(`/api/tasks/${longId}`);

      expect(res.status).toBe(404);
      if (isFastify) {
        expect(res.body).toEqual({ error: 'Not found' });
      } else {
        expect(res.body).toEqual({ error: 'Task not found' });
      }
    });
  });

  // U1: 14 KiB webhook update verification
  describe('U1: 14 KiB Telegram webhook update verification', () => {
    it('verifies 14 KiB webhook update status against current body limit', async () => {
      // 4096 Thai characters * 3 bytes/char = 12,288 bytes + envelope > 14 KiB
      const largeText = 'ก'.repeat(4096);
      const payload = {
        update_id: 99999,
        message: {
          message_id: 1,
          date: 1700000000,
          chat: { id: 987654321, type: 'private' },
          text: largeText,
        },
      };

      const res = await request(ctx.server)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'test-webhook-secret')
        .send(payload);

      if (isFastify) {
        // Fastify / D3 target: 1 MiB limit for webhook
        expect(res.status).toBe(200);
      } else {
        // Baseline Express (pre-D3): 10 KiB global limit returns 413
        expect(res.status).toBe(413);
      }
    });
  });

  // U2: Mutating routes content-type guard
  describe('U2: Content-Type protection on mutating routes', () => {
    const mutatingEndpoints = [
      { method: 'post' as const, path: '/api/tasks' },
      { method: 'put' as const, path: '/api/tasks/sample1' },
      { method: 'patch' as const, path: '/api/tasks/sample1/status' },
      { method: 'patch' as const, path: '/api/tasks/sample1/order' },
      { method: 'post' as const, path: '/api/notes' },
      { method: 'patch' as const, path: '/api/notes/sample1' },
      { method: 'post' as const, path: '/api/notes/sample1/convert' },
    ];

    it.each(mutatingEndpoints)(
      'rejects or guards against text/plain on $method $path',
      async ({ method, path }) => {
        const res = await (request(ctx.server)[method](path) as any)
          .set('Content-Type', 'text/plain')
          .send('arbitrary text');

        if (isFastify) {
          expect(res.status).toBe(415);
        } else {
          expect([400, 404]).toContain(res.status);
        }
      }
    );

    it.each(mutatingEndpoints)(
      'rejects or guards against application/x-www-form-urlencoded on $method $path',
      async ({ method, path }) => {
        const res = await (request(ctx.server)[method](path) as any)
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('key=value');

        if (isFastify) {
          expect(res.status).toBe(415);
        } else {
          expect([400, 404]).toContain(res.status);
        }
      }
    );
  });
});
