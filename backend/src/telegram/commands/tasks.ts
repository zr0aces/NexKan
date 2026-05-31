import { readAll } from '../../tasks/store';
import { Task } from '../../types/task';

function formatTask(t: Task): string {
  const due = t.due_date ? ` · Due: ${t.due_date}` : '';
  const priority = t.priority ? ` [${t.priority}]` : '';
  return `• ${t.title} (${t.id})${priority}${due}`;
}

export async function handleTasks(ctx: any): Promise<void> {
  try {
    const tasks = await readAll({ status: 'plan,todo,in-progress' });
    if (tasks.length === 0) {
      await ctx.reply('No tasks found.');
      return;
    }

    const grouped: Record<string, Task[]> = { plan: [], todo: [], 'in-progress': [] };
    for (const t of tasks) {
      if (grouped[t.status]) grouped[t.status].push(t);
    }

    const lines: string[] = [];
    if (grouped.plan.length > 0) {
      lines.push('📋 Plan:');
      grouped.plan.forEach(t => lines.push(formatTask(t)));
    }
    if (grouped.todo.length > 0) {
      lines.push('\n📌 Todo:');
      grouped.todo.forEach(t => lines.push(formatTask(t)));
    }
    if (grouped['in-progress'].length > 0) {
      lines.push('\n🔄 In Progress:');
      grouped['in-progress'].forEach(t => lines.push(formatTask(t)));
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
