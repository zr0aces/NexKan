import { readAll } from '../../tasks/store';
import { Task, formatDate } from '@nexkan/shared';
import { escapeMd, isAuthorizedChat } from '../utils';

function formatTask(t: Task): string {
  const due = t.due_date ? ` · Due: ${formatDate(t.due_date)}` : '';
  const priority = t.priority ? ` [${t.priority}]` : '';
  return `• ${escapeMd(t.title)} (${t.id})${priority}${due}`;
}

export async function handleTasks(ctx: any): Promise<void> {
  if (!isAuthorizedChat(ctx)) return;
  try {
    const tasks = await readAll({ status: 'todo,in-progress', sort: 'sort_order:asc' });
    if (tasks.length === 0) {
      await ctx.reply('No tasks found.');
      return;
    }

    const lines: string[] = [];
    const todo = tasks.filter(t => t.status === 'todo');
    const inProgress = tasks.filter(t => t.status === 'in-progress');

    if (inProgress.length > 0) {
      lines.push('🔄 In Progress:');
      inProgress.forEach(t => lines.push(formatTask(t)));
    }
    if (todo.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('📌 Todo:');
      todo.forEach(t => lines.push(formatTask(t)));
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
