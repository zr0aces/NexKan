import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createApp } from '../../src/app';
import { TaskStore } from '../../src/tasks/store';
import { NoteStore } from '../../src/scratchpad/store';
import { FileSystemStorageProvider } from '../../src/storage/fileSystem';
import { Task, Note } from '@nexkan/shared';
import { serializeTask } from '../../src/tasks/parser';
import { serializeNote } from '../../src/scratchpad/parser';

export const SERVER_MODE = (process.env.TEST_SERVER_MODE || 'express') as 'express' | 'fastify';
export const isFastify = SERVER_MODE === 'fastify';

export interface ContractTestContext {
  server: http.Server;
  taskStore: TaskStore;
  noteStore: NoteStore;
  taskDir: string;
  noteDir: string;
  writeTask: (task: Task) => void;
  writeNote: (note: Note) => void;
  close: () => Promise<void>;
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345',
    title: 'Contract Test Task',
    status: 'todo',
    tags: [],
    sort_order: 1,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    attachments: [],
    description: 'Contract test description.',
    due_date: '2099-12-31',
    ...overrides,
  };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note1234',
    content: 'First line note\nSecond line note',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

export function createContractServer(appInstance?: any): http.Server {
  if (appInstance) {
    if (isFastify) {
      return appInstance.server || appInstance;
    }
    return http.createServer(appInstance);
  }
  const app = require('../../src/app').default;
  if (isFastify) {
    return app.server || app;
  }
  return http.createServer(app);
}

export async function createContractTestContext(): Promise<ContractTestContext> {
  const taskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-contract-tasks-'));
  const noteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-contract-notes-'));

  const taskStore = new TaskStore(new FileSystemStorageProvider(taskDir));
  const noteStore = new NoteStore(new FileSystemStorageProvider(noteDir));

  let server: http.Server;

  if (isFastify) {
    const { buildApp } = require('../../src/app');
    const fastifyApp = await buildApp(taskStore, noteStore);
    await fastifyApp.ready();
    server = fastifyApp.server;
  } else {
    const expressApp = createApp(taskStore, noteStore);
    server = http.createServer(expressApp);
  }

  const writeTask = (task: Task): void => {
    const slug = task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const filename = `${task.id}-${slug}.md`;
    fs.writeFileSync(path.join(taskDir, filename), serializeTask(task));
  };

  const writeNote = (note: Note): void => {
    const filename = `${note.id}.md`;
    fs.writeFileSync(path.join(noteDir, filename), serializeNote(note));
  };

  return {
    server,
    taskStore,
    noteStore,
    taskDir,
    noteDir,
    writeTask,
    writeNote,
    close: async () => {
      taskStore.close();
      noteStore.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      fs.rmSync(taskDir, { recursive: true, force: true });
      fs.rmSync(noteDir, { recursive: true, force: true });
    },
  };
}
