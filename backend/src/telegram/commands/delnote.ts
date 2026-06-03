import { deleteNote, NotFoundError } from '../../scratchpad/store';
import type { CommandContext } from 'grammy';

export async function handleDelnote(ctx: CommandContext<any>): Promise<void> {
  const id: string = ctx.match?.trim() ?? '';
  if (!id) {
    await ctx.reply('Usage: /delnote <id>\nExample: /delnote abc12345');
    return;
  }
  try {
    await deleteNote(id);
    await ctx.reply(`🗑 Note ${id} deleted.`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await ctx.reply(`Note ${id} not found.`);
      return;
    }
    await ctx.reply('Something went wrong. Try again.');
  }
}
