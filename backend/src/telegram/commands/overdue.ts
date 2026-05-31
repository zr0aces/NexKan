import { readAll } from '../../tasks/store';
import { Task } from '../../types/task';
import { escapeMd } from '../utils';
import { formatDate } from '../../lib/date';

function formatTask(t: Task): string {
  const due = t.due_date ? ` · Due: ${formatDate(t.due_date)}` : '';
  return `• ${escapeMd(t.title)} (${t.id})${due}`;
}

export async function handleOverdue(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ overdue: true });
    if (tasks.length === 0) {
      await ctx.reply('No overdue tasks. 🎉', { parse_mode: 'Markdown' });
      return;
    }
    const lines = ['⚠️ Overdue tasks:'];
    tasks.forEach(t => lines.push(formatTask(t)));
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
