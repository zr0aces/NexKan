import { updateStatus, readById } from '../tasks/store';
import { InlineKeyboard } from 'grammy';
import { escapeMd } from './utils';
import { formatDate } from '../lib/date';

export async function handleCallback(ctx: any): Promise<void> {
  const data: string = ctx.callbackQuery?.data ?? '';

  if (data.startsWith('move:')) {
    const parts = data.split(':');
    const taskId = parts[1];
    const newStatus = parts[2];
    try {
      await updateStatus(taskId, newStatus, undefined);
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

      const keyboard = new InlineKeyboard()
        .text('▶ Start', `move:${task.id}:in-progress`)
        .text('✅ Complete', `move:${task.id}:done`)
        .row()
        .text('📌 Todo', `move:${task.id}:todo`);

      await ctx.answerCallbackQuery();
      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      await ctx.answerCallbackQuery({ text: 'Something went wrong.' });
    }
    return;
  }

  await ctx.answerCallbackQuery();
}
