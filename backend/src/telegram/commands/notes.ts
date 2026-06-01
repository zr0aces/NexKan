import { readAll } from '../../scratchpad/store';
import { escapeMd } from '../utils';

export async function handleNotes(ctx: any): Promise<void> {
  try {
    const notes = await readAll();
    if (notes.length === 0) {
      await ctx.reply('No scratchpad notes.');
      return;
    }
    const lines = notes.map((n, i) => {
      const preview = n.content.length > 60 ? n.content.slice(0, 57) + '...' : n.content;
      return `${i + 1}. (${n.id}) ${escapeMd(preview)}`;
    });
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
