import { Task, Note, formatDate } from '@nexkan/shared';
import { InlineKeyboard } from 'grammy';

export function escapeMd(text: string): string {
  return text.replace(/[*_`[\]]/g, '\\$&');
}

export class TelegramPresenter {
  /**
   * Format a single task summary line for list display.
   */
  static formatTaskItem(t: Task, options: { showPriority?: boolean; showDueDate?: boolean } = {}): string {
    const due = options.showDueDate !== false && t.due_date ? ` · Due: ${formatDate(t.due_date)}` : '';
    const priority = options.showPriority !== false && t.priority ? ` [${t.priority}]` : '';
    return `• ${escapeMd(t.title)} (${t.id})${priority}${due}`;
  }

  /**
   * Format a list of tasks under a single header.
   */
  static formatTaskList(header: string, tasks: Task[]): string {
    if (tasks.length === 0) return '';
    const lines = [header];
    tasks.forEach(t => lines.push(this.formatTaskItem(t)));
    return lines.join('\n');
  }

  /**
   * Format grouped task lists (e.g. In Progress & Todo sections).
   */
  static formatGroupedTasks(groups: Array<{ header: string; tasks: Task[] }>): string {
    const sectionBlocks = groups
      .filter(g => g.tasks.length > 0)
      .map(g => this.formatTaskList(g.header, g.tasks));

    return sectionBlocks.join('\n\n');
  }

  /**
   * Format detailed view for a single task.
   */
  static formatTaskDetail(t: Task): string {
    const lines: string[] = [
      `*${escapeMd(t.title)}*`,
      `Status: ${t.status}`,
      `Priority: ${t.priority ?? 'none'}`,
      `Due: ${t.due_date ? formatDate(t.due_date) : 'none'}`,
    ];

    if (t.tags.length > 0) {
      lines.push(`Tags: ${t.tags.join(', ')}`);
    }
    if (t.description) {
      lines.push(`\n_${escapeMd(t.description)}_`);
    }
    if (t.notes) {
      lines.push(`\n*Notes:*\n${escapeMd(t.notes)}`);
    }
    return lines.join('\n');
  }

  /**
   * Format a single note line.
   */
  static formatNoteItem(note: Note): string {
    const lines = note.content.split('\n');
    const firstLine = lines[0].trim();
    const snippet = escapeMd(firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine);
    const hasMore = lines.length > 1 ? ' (...)' : '';
    return `• (${note.id}) ${snippet}${hasMore}`;
  }

  /**
   * Format list of notes.
   */
  static formatNoteList(notes: Note[]): string {
    if (notes.length === 0) return 'No notes found.';
    const lines = ['📝 *Scratchpad Notes:*'];
    notes.forEach(n => lines.push(this.formatNoteItem(n)));
    return lines.join('\n');
  }

  /**
   * Build Telegram inline keyboard for task state transitions.
   */
  static buildTaskKeyboard(taskId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('▶ Start', `move:${taskId}:in-progress`)
      .text('✅ Complete', `move:${taskId}:done`)
      .row()
      .text('📌 Todo', `move:${taskId}:todo`);
  }
}
