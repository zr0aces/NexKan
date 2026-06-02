import { Request, Response, NextFunction } from 'express';

export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  next();
}

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET;
  // Reject explicitly when no secret is configured — empty string is not valid.
  if (!secret) {
    console.error('CRON_SECRET is not set; rejecting cron request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const header = req.headers['x-cron-secret'];
  if (header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
