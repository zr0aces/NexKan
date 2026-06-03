import { readAll } from '../../tasks/store';
import { Task } from '@nexkan/shared';
import { escapeMd } from '../utils';
import type { Context } from 'grammy';

function formatTask(t: Task): string {
  const priority = t.priority ? ` [${t.priority}]` : '';
  const status = ` · ${t.status}`;
  return `• ${escapeMd(t.title)} (${t.id})${priority}${status}`;
}

export async function handleToday(ctx: Context): Promise<void> {
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
