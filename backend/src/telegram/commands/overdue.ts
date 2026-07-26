import { TaskStore } from '../../tasks/store';
import { TelegramPresenter } from '../presenter';
import type { Context } from 'grammy';

export async function handleOverdue(ctx: Context, taskStore: TaskStore): Promise<void> {
  try {
    const tasks = await taskStore.readAll({ overdue: true });
    if (tasks.length === 0) {
      await ctx.reply('No overdue tasks. 🎉', { parse_mode: 'Markdown' });
      return;
    }
    const message = TelegramPresenter.formatTaskList('⚠️ Overdue tasks:', tasks);
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
