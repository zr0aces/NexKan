import { updateStatus, readById } from '../tasks/store';
import type { Context } from 'grammy';
import { escapeMd, buildTaskKeyboard } from './utils';
import { formatDate, TASK_STATUSES, TaskStatus } from '@nexkan/shared';

export async function handleCallback(ctx: Context): Promise<void> {
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
      const task = await updateStatus(taskId, newStatus as TaskStatus, undefined);
      await ctx.answerCallbackQuery({ text: `✅ Moved to ${newStatus}` });

      const lines = [
        `*${escapeMd(task.title)}* (${task.id})`,
        `Status: ${task.status}`,
        task.due_date ? `Due: ${formatDate(task.due_date)}` : '',
        task.priority ? `Priority: ${task.priority}` : '',
        task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
        task.description ? `\n${task.description}` : '',
      ].filter(Boolean);

      const keyboard = buildTaskKeyboard(task.id);
      try {
        await ctx.editMessageText(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
      } catch (err: any) {
        if (!err.message?.includes('message is not modified')) {
          console.error('Failed to edit callback message:', err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      const text = msg.includes('due_date')
        ? 'Please set a due date before moving to this status.'
        : 'Something went wrong.';
      await ctx.answerCallbackQuery({ text });
    }
    return;
  }

  if (data.startsWith('view:')) {
    const taskId = data.split(':')[1];
    try {
      const task = await readById(taskId);
      if (!task) {
        await ctx.answerCallbackQuery({ text: 'Task not found.' });
        return;
      }
      const lines = [
        `*${escapeMd(task.title)}* (${task.id})`,
        `Status: ${task.status}`,
        task.due_date ? `Due: ${formatDate(task.due_date)}` : '',
        task.priority ? `Priority: ${task.priority}` : '',
      ].filter(Boolean);

      const keyboard = buildTaskKeyboard(task.id);

      await ctx.answerCallbackQuery();
      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.answerCallbackQuery({ text: 'Something went wrong.' });
    }
    return;
  }

  await ctx.answerCallbackQuery();
}
