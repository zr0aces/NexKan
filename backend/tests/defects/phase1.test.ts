import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import request from 'supertest';
import { TaskStore } from '../../src/tasks/store';
import { FileSystemStorageProvider } from '../../src/storage/fileSystem';
import { Task } from '@nexkan/shared';
import { serializeTask } from '../../src/tasks/parser';
import * as notifier from '../../src/telegram/notifier';
import { getBot } from '../../src/telegram/bot';
import { createApp, buildApp } from '../../src/app';
import { NoteStore } from '../../src/scratchpad/store';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'abc12345',
    title: 'Test Task',
    status: 'todo',
    tags: [],
    sort_order: 1,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    attachments: [],
    description: 'Description',
    due_date: '2099-12-31',
    ...overrides,
  };
}

describe('Phase 1 Defect and Security Fixes (F1-F6, D1-D3)', () => {
  // F1: 20-iteration rename regression test on real filesystem
  describe('F1: Rename cache consistency', () => {
    let tmpDir: string;
    let storage: FileSystemStorageProvider;
    let store: TaskStore;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-f1-test-'));
      storage = new FileSystemStorageProvider(tmpDir);
      store = new TaskStore(storage);
    });

    afterEach(() => {
      store.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('retains task in cache across 20 rapid title renames on real filesystem', async () => {
      for (let run = 0; run < 10; run++) {
        const task = await store.create({
          title: `Initial Title Run ${run}`,
          status: 'done',
        });

        for (let i = 0; i < 20; i++) {
          await store.update(task.id, { title: `Rename Run ${run} Step ${i}` });
        }

        // Give watcher a moment to process events
        await sleep(100);

        const fetched = await store.readById(task.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.title).toBe(`Rename Run ${run} Step 19`);

        await store.deleteTask(task.id);
      }
    });
  });

  // F2: Watcher handles task IDs containing dash
  describe('F2: Task IDs containing dash', () => {
    let tmpDir: string;
    let storage: FileSystemStorageProvider;
    let store: TaskStore;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-f2-test-'));
      storage = new FileSystemStorageProvider(tmpDir);
      store = new TaskStore(storage);
    });

    afterEach(() => {
      store.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('properly observes file watcher updates for nanoid containing dashes (e.g. 6-U9UWe4)', async () => {
      const dashId = '6-U9UWe4';
      const initialTask = makeTask({ id: dashId, title: 'Dash Task Initial' });
      const filename = `${dashId}-dash-task-initial.md`;

      await storage.write(filename, serializeTask(initialTask));

      // Trigger cache load
      const tasksBefore = await store.readAll();
      expect(tasksBefore.some(t => t.id === dashId)).toBe(true);

      // External update simulation
      const updatedTask = makeTask({ id: dashId, title: 'Dash Task Updated From Outside' });
      await storage.write(filename, serializeTask(updatedTask));

      // Allow debounce and fs.watch callback
      await sleep(150);

      const tasksAfter = await store.readById(dashId);
      expect(tasksAfter).not.toBeNull();
      expect(tasksAfter?.title).toBe('Dash Task Updated From Outside');
    });
  });

  // F4: Atomic writes via temporary file
  describe('F4: Atomic writes', () => {
    let tmpDir: string;
    let storage: FileSystemStorageProvider;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-f4-test-'));
      storage = new FileSystemStorageProvider(tmpDir);
    });

    afterEach(() => {
      storage.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes files atomically and does not leave temporary files on success', async () => {
      await storage.write('test-file.md', 'hello atomic world');
      const content = await storage.read('test-file.md');
      expect(content).toBe('hello atomic world');

      const files = fs.readdirSync(tmpDir);
      expect(files).toEqual(['test-file.md']);
      expect(files.some(f => f.endsWith('.tmp'))).toBe(false);
    });
  });

  // F5: Concurrency single-flight in checkAndNotify
  describe('F5: Concurrent checkAndNotify single-flight execution', () => {
    let tmpDir: string;
    let store: TaskStore;
    const originalEnv = process.env;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-f5-test-'));
      process.env = {
        ...originalEnv,
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        TELEGRAM_CHAT_ID: '987654321',
        NOTIFICATIONS_FILE: path.join(tmpDir, 'notifications-sent.json'),
      };
      store = new TaskStore(new FileSystemStorageProvider(tmpDir));
    });

    afterEach(() => {
      store.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    it('shares in-flight promise and sends message exactly once on concurrent calls', async () => {
      await store.create({
        title: 'Overdue Task',
        status: 'todo',
        due_date: '2020-01-01',
      });

      const bot = getBot();
      const sendSpy = jest.spyOn(bot.api, 'sendMessage').mockImplementation(async () => {
        await sleep(50);
        return {} as any;
      });

      // Call checkAndNotify concurrently
      await Promise.all([
        notifier.checkAndNotify(store),
        notifier.checkAndNotify(store),
      ]);

      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  // D2: Startup refusal on misconfigured Telegram
  describe('D2: Startup checks for Telegram credentials', () => {
    const serverScript = path.resolve(__dirname, '../../src/server.ts');

    it('exits with code 1 when TELEGRAM_BOT_TOKEN is set but TELEGRAM_WEBHOOK_SECRET is missing', () => {
      const res = spawnSync('npx', ['ts-node', serverScript], {
        env: {
          ...process.env,
          TELEGRAM_BOT_TOKEN: 'token123',
          TELEGRAM_WEBHOOK_SECRET: '',
          TELEGRAM_CHAT_ID: 'chat123',
          PORT: '49152',
        },
        encoding: 'utf-8',
      });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Telegram misconfigured: TELEGRAM_BOT_TOKEN is set but TELEGRAM_WEBHOOK_SECRET is missing');
    });

    it('exits with code 1 when TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing', () => {
      const res = spawnSync('npx', ['ts-node', serverScript], {
        env: {
          ...process.env,
          TELEGRAM_BOT_TOKEN: 'token123',
          TELEGRAM_WEBHOOK_SECRET: 'secret123',
          TELEGRAM_CHAT_ID: '',
          PORT: '49153',
        },
        encoding: 'utf-8',
      });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Telegram misconfigured: TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing');
    });

    it('starts successfully when neither TELEGRAM_BOT_TOKEN nor secrets are set', () => {
      // Start in background and check output then kill
      const child = spawnSync('node', ['-e', `
        process.env.TELEGRAM_BOT_TOKEN = '';
        process.env.PORT = '49154';
        const server = require('../../dist/server.js');
        setTimeout(() => process.exit(0), 400);
      `], {
        cwd: __dirname,
        encoding: 'utf-8',
        timeout: 2000,
      });

      expect(child.status).toBe(0);
    });
  });

  // D3: 1 MiB webhook body limit vs 10 KiB global limit
  describe('D3: Body size limits (1 MiB webhook vs 10 KiB standard)', () => {
    let tmpDir: string;
    let fastifyApp: any;
    let app: any;
    const originalEnv = process.env;

    beforeEach(async () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-d3-test-'));
      process.env = {
        ...originalEnv,
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        TELEGRAM_CHAT_ID: '987654321',
        TELEGRAM_WEBHOOK_SECRET: 'secret123',
      };
      const taskStore = new TaskStore(new FileSystemStorageProvider(path.join(tmpDir, 'tasks')));
      const noteStore = new NoteStore(new FileSystemStorageProvider(path.join(tmpDir, 'notes')));
      fastifyApp = buildApp(taskStore, noteStore);
      await fastifyApp.ready();
      app = fastifyApp.server;
    });

    afterEach(async () => {
      if (fastifyApp) await fastifyApp.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    it('accepts authorized 14 KiB webhook update with HTTP 200', async () => {
      const bot = getBot();
      jest.spyOn(bot, 'handleUpdate').mockResolvedValue();

      const largeText = 'ก'.repeat(4096); // 12+ KiB
      const res = await request(app)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'secret123')
        .send({
          update_id: 1,
          message: {
            message_id: 1,
            date: 1700000000,
            chat: { id: 987654321, type: 'private' },
            text: largeText,
          },
        });

      expect(res.status).toBe(200);
    });

    it('rejects 11 KiB standard request with HTTP 413', async () => {
      const largePayload = {
        title: 'Large Task',
        description: 'a'.repeat(11 * 1024),
      };

      const res = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
    });

    it('rejects unauthorized oversized webhook payload with 401 before body parsing', async () => {
      const largeText = 'ก'.repeat(4096);
      const res = await request(app)
        .post('/api/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'wrong-secret')
        .send({
          update_id: 1,
          message: {
            text: largeText,
          },
        });

      expect(res.status).toBe(401);
    });
  });
});
