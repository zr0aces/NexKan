import { readById } from '../../tasks/store';
import { escapeMd, buildTaskKeyboard } from '../utils';
import { formatDate } from '@nexkan/shared';
import type { CommandContext } from 'grammy';

export async function handleTask(ctx: CommandContext<any>): Promise<void> {
  try {
    const id: string = ctx.match?.trim() ?? '';
    if (!id) {
      await ctx.reply('Usage: /task <id>');
      return;
    }

    const task = await readById(id);
    if (!task) {
      await ctx.reply(`Task ${id} not found.`);
      return;
    }

    const lines = [
      `*${escapeMd(task.title)}* (${task.id})`,
      `Status: ${task.status}`,
      task.due_date ? `Due: ${formatDate(task.due_date)}` : '',
      task.priority ? `Priority: ${task.priority}` : '',
      task.tags.length > 0 ? `Tags: ${task.tags.map(escapeMd).join(', ')}` : '',
      task.description ? `\n${escapeMd(task.description)}` : '',
    ].filter(Boolean);

    const keyboard = buildTaskKeyboard(task.id);

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
