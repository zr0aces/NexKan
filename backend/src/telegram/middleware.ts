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

function validateSecret(
  headerVal: string | string[] | undefined,
  secret: string | undefined,
  missingLogMessage: string,
  reply: FastifyReply
): void {
  if (!secret) {
    console.error(missingLogMessage);
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  const header = headerString(headerVal);
  if (!header || !safeCompare(header, secret)) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}

export async function webhookAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  validateSecret(
    request.headers['x-telegram-bot-api-secret-token'],
    process.env.TELEGRAM_WEBHOOK_SECRET,
    'TELEGRAM_WEBHOOK_SECRET is not set; rejecting webhook request',
    reply
  );
}

export async function cronAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  validateSecret(
    request.headers['x-cron-secret'],
    process.env.CRON_SECRET,
    'CRON_SECRET is not set; rejecting cron request',
    reply
  );
}
