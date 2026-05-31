import { readById } from '../../tasks/store';
import { InlineKeyboard } from 'grammy';
import { escapeMd } from '../utils';

export async function handleTask(ctx: any): Promise<void> {
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
      task.due_date ? `Due: ${task.due_date}` : '',
      task.priority ? `Priority: ${task.priority}` : '',
      task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
      task.description ? `\n${task.description}` : '',
    ].filter(Boolean);

    const keyboard = new InlineKeyboard()
      .text('▶ Start', `move:${task.id}:in-progress`)
      .text('✅ Complete', `move:${task.id}:done`)
      .row()
      .text('📌 Todo', `move:${task.id}:todo`);

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
