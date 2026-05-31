export async function handleHelp(ctx: any): Promise<void> {
  try {
    await ctx.reply(
      `NexKan Commands:\n\n` +
      `/add <title> [date] — Create task (accepts: "tomorrow", "next monday", "2026-06-01")\n` +
      `/tasks — List all non-done tasks\n` +
      `/today — Tasks due today\n` +
      `/overdue — Overdue tasks\n` +
      `/task <id> — Task detail + actions\n` +
      `/move <id> <status> — Move task (plan|todo|in-progress|done)`
    );
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
