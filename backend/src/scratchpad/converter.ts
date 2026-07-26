import { Task, TaskPriority, TaskStatus, requiresDueDate } from '@nexkan/shared';
import { NoteStore, NotFoundError } from './store';
import { TaskStore } from '../tasks/store';

export interface ConvertNoteOptions {
  due_date?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export class NoteConverter {
  constructor(
    private noteStore: NoteStore,
    private taskStore: TaskStore
  ) {}

  async convert(id: string, options: ConvertNoteOptions = {}): Promise<Task> {
    const note = await this.noteStore.readById(id);
    if (!note) {
      throw new NotFoundError(`Note ${id} not found`);
    }

    const lines = note.content.split('\n');
    const title = lines[0].trim();
    if (!title) {
      throw new Error('Note first line must be non-empty to use as task title');
    }

    const description = lines.slice(1).join('\n').trim() || undefined;
    const status = options.status ?? 'todo';

    if (requiresDueDate(status) && !options.due_date) {
      throw new Error(`due_date is required for task status "${status}"`);
    }

    const task = await this.taskStore.create({
      title,
      description,
      due_date: options.due_date,
      priority: options.priority,
      status,
    });

    await this.noteStore.deleteNote(id);
    return task;
  }
}
