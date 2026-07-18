import express from 'express';
import { createTaskRouter } from './tasks/router';
import { createNoteRouter } from './scratchpad/router';
import { createTelegramRouter } from './telegram/router';
import { FileSystemStorageProvider } from './storage/fileSystem';
import { TaskStore } from './tasks/store';
import { NoteStore } from './scratchpad/store';
import * as path from 'path';

export function createApp(taskStore: TaskStore, noteStore: NoteStore): express.Express {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/tasks', createTaskRouter(taskStore));
  app.use('/api/notes', createNoteRouter(noteStore, taskStore));
  app.use('/api', createTelegramRouter(taskStore, noteStore));
  return app;
}

// Production / Default exports for running the server and backward compatibility:
const getTaskDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data', 'tasks');
const getScratchpadDir = () => process.env.SCRATCHPAD_DIR || path.join(process.cwd(), 'data', 'scratchpad');

export const defaultTaskStore = new TaskStore(new FileSystemStorageProvider(getTaskDir()));
export const defaultNoteStore = new NoteStore(new FileSystemStorageProvider(getScratchpadDir()));

const app = createApp(defaultTaskStore, defaultNoteStore);
export default app;
