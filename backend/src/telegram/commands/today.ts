import { readAll } from '../../tasks/store';
import { Task } from '../../types/task';

function formatTask(t: Task): string {
  const priority = t.priority ? ` [${t.priority}]` : '';
  const status = ` · ${t.status}`;
  return `• ${t.title} (${t.id})${priority}${status}`;
}

export async function handleToday(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ due_today: true });
    if (tasks.length === 0) {
      await ctx.reply('No tasks due today.', { parse_mode: 'Markdown' });
      return;
    }
    const lines = ['🔔 Due today:'];
    tasks.forEach(t => lines.push(formatTask(t)));
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
