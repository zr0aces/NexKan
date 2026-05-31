import { Request, Response, NextFunction } from 'express';

export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (!secret || header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function cronAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CRON_SECRET;
  const header = req.headers['x-cron-secret'];
  if (!secret || header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
