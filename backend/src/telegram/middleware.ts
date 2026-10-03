import { Request, Response, NextFunction } from 'express';
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

export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not set; rejecting webhook request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const header = headerString(req.headers['x-telegram-bot-api-secret-token']);
  if (!header || !safeCompare(header, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set; rejecting cron request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const header = headerString(req.headers['x-cron-secret']);
  if (!header || !safeCompare(header, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

