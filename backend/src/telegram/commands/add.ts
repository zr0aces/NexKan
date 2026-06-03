import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import { create } from '../../tasks/store';
import { formatDate } from '@nexkan/shared';
import type { CommandContext } from 'grammy';

export async function handleAdd(ctx: CommandContext<any>): Promise<void> {
  try {
    const text: string = ctx.match?.trim() ?? '';
    if (!text) {
      await ctx.reply('Usage: /add <title> [date]\nExample: /add Buy milk tomorrow');
      return;
    }

    const parsed = chrono.parse(text);
    let title = text;
    let due_date: string | undefined;

    if (parsed.length > 0) {
      const dateResult = parsed[parsed.length - 1];
      due_date = format(dateResult.date(), 'yyyy-MM-dd');
      const beforeDate = text.slice(0, dateResult.index).trim();
      if (beforeDate) title = beforeDate;
    }

    const task = await create({ title, due_date, status: 'todo', description: '' });
    await ctx.reply(`✅ Task created: ${task.title} (${task.id})${due_date ? `\nDue: ${formatDate(due_date)}` : ''}`);
  } catch (err) {
    const msg = err instanceof Error && err.message.includes('due_date')
      ? '⚠️ A due date is required.\nExample: /add Buy milk tomorrow'
      : 'Something went wrong. Try again.';
    await ctx.reply(msg);
  }
}
