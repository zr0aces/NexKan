import { Request, Response, NextFunction } from 'express';

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = headerString(req.headers['x-telegram-bot-api-secret-token']);
    if (header !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
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
  if (header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
