import { updateStatus } from '../tasks/store';
import type { Context } from 'grammy';
import { isAuthorizedChat } from './utils';
import { TASK_STATUSES, TaskStatus } from '@nexkan/shared';

export async function handleCallback(ctx: Context): Promise<void> {
  if (!isAuthorizedChat(ctx)) {
    await ctx.answerCallbackQuery();
    return;
  }

  const data: string = ctx.callbackQuery?.data ?? '';

  if (data.startsWith('move:')) {
    const parts = data.split(':');
    if (parts.length < 3 || !parts[1] || !parts[2]) {
      await ctx.answerCallbackQuery({ text: 'Invalid callback data.' });
      return;
    }
    const taskId = parts[1];
    const newStatus = parts[2];
    if (!TASK_STATUSES.includes(newStatus as TaskStatus)) {
      await ctx.answerCallbackQuery({ text: 'Invalid status.' });
      return;
    }
    try {
      await updateStatus(taskId, newStatus as TaskStatus, undefined);
      await ctx.answerCallbackQuery({ text: `✅ Moved to ${newStatus}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      const text = msg.includes('due_date')
        ? 'Please set a due date before moving to this status.'
        : 'Something went wrong.';
      await ctx.answerCallbackQuery({ text });
    }
    return;
  }

  await ctx.answerCallbackQuery();
}
