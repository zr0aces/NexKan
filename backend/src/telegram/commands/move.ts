import { readById, updateStatus } from '../../tasks/store';
import { TaskStatus } from '../../types/task';

const VALID_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

export async function handleMove(ctx: any): Promise<void> {
  try {
    const args: string = ctx.match?.trim() ?? '';
    const parts = args.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      await ctx.reply('Usage: /move <id> <status>\nStatuses: todo, in-progress, done');
      return;
    }

    const [id, rawStatus] = parts;
    const status = rawStatus.toLowerCase() as TaskStatus;

    if (!VALID_STATUSES.includes(status)) {
      await ctx.reply(`Invalid status. Use: ${VALID_STATUSES.join(', ')}`);

      return;
    }

    const task = await readById(id);
    if (!task) {
      await ctx.reply(`Task ${id} not found.`);
      return;
    }

    const requiresDueDate = status === 'todo' || status === 'in-progress';
    if (requiresDueDate && !task.due_date) {
      await ctx.reply(`Task "${task.title}" has no due date.\nPlease set a due date before moving to ${status}.`);
      return;
    }

    await updateStatus(id, status, undefined);
    await ctx.reply(`✅ Moved "${task.title}" → ${status}`);
  } catch {
    await ctx.reply('Something went wrong. Try again.');
  }
}
