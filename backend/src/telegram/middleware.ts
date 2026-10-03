import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeCompare(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function webhookAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set; rejecting webhook request');
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const header = headerString(request.headers['x-telegram-bot-api-secret-token']);
  if (!header || !safeCompare(header, secret)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function cronAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set; rejecting cron request');
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const header = headerString(request.headers['x-cron-secret']);
  if (!header || !safeCompare(header, secret)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
