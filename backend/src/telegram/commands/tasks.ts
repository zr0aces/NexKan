import { TaskStore } from '../../tasks/store';
import { TelegramPresenter } from '../presenter';
import type { Context } from 'grammy';

export async function handleTasks(ctx: Context, taskStore: TaskStore): Promise<void> {
  try {
    const tasks = await taskStore.readAll({ status: 'todo,in-progress', sort: 'sort_order:asc' });
    if (tasks.length === 0) {
      await ctx.reply('No tasks found.');
      return;
    }

    const message = TelegramPresenter.formatGroupedTasks([
      { header: '🔄 In Progress:', tasks: tasks.filter(t => t.status === 'in-progress') },
      { header: '📌 Todo:', tasks: tasks.filter(t => t.status === 'todo') },
    ]);

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
