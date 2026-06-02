import { isAuthorizedChat } from '../utils';

export async function handleHelp(ctx: any): Promise<void> {
  if (!isAuthorizedChat(ctx)) return;
  try {
    await ctx.reply(
      `NexKan Commands:\n\n` +
      `/add <title> [date] — Create task (accepts: "tomorrow", "next monday", "2026-06-01")\n` +
      `/tasks — List all non-done tasks\n` +
      `/today — Tasks due today\n` +
      `/overdue — Overdue tasks\n` +
      `/task <id> — Task detail + actions\n` +
      `/move <id> <status> — Move task (todo|in-progress|done)\n\n` +
      `Scratchpad:\n` +
      `/note <text> — Save a quick note\n` +
      `/notes — List all notes\n` +
      `/delnote <id> — Delete a note by id`
    );
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
