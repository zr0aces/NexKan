import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import { create } from '../../tasks/store';

export async function handleAdd(ctx: any): Promise<void> {
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
    await ctx.reply(`✅ Task created: ${task.title} (${task.id})${due_date ? `\nDue: ${due_date}` : ''}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
