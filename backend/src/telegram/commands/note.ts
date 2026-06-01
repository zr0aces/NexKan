import { create } from '../../scratchpad/store';
import { isAuthorizedChat } from '../utils';

export async function handleNote(ctx: any): Promise<void> {
  if (!isAuthorizedChat(ctx)) return;
  const text: string = ctx.match?.trim() ?? '';
  if (!text) {
    await ctx.reply('Usage: /note <text>\nExample: /note Call dentist Monday');
    return;
  }
  try {
    const note = await create(text);
    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
    await ctx.reply(`📝 Note saved (${note.id}): ${preview}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
