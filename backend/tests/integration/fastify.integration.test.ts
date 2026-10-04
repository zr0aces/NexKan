import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { buildApp } from '../../src/app';
import { TaskStore } from '../../src/tasks/store';
import { NoteStore } from '../../src/scratchpad/store';
import { FileSystemStorageProvider } from '../../src/storage/fileSystem';
import { getBot } from '../../src/telegram/bot';

describe('Fastify Integration Tests (§6.3)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      TELEGRAM_CHAT_ID: '987654321',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      CRON_SECRET: 'test-cron-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Spec line 478: Webhook end to end: a sample /add Buy milk tomorrow update injected through app.inject() with the bot API stubbed. Assert that a file is created.
  it('handles end-to-end webhook update via app.inject() and creates task file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-webhook-e2e-'));
    const taskDir = path.join(tmpDir, 'tasks');
    const noteDir = path.join(tmpDir, 'notes');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.mkdirSync(noteDir, { recursive: true });

    const taskStore = new TaskStore(new FileSystemStorageProvider(taskDir));
    const noteStore = new NoteStore(new FileSystemStorageProvider(noteDir));
    const app = await buildApp(taskStore, noteStore);
    await app.ready();

    const { setupBotCommands } = require('../../src/telegram/router');
    setupBotCommands(taskStore, noteStore);

    const bot = getBot();
    bot.botInfo = { id: 123456, is_bot: true, first_name: 'TestBot', username: 'test_bot' } as any;
    jest.spyOn(bot.api, 'getMe').mockResolvedValue(bot.botInfo);
    bot.api.config.use(async (_prev, _method, _payload, _signal) => ({ ok: true, result: {} as any }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/telegram',
      headers: {
        'x-telegram-bot-api-secret-token': 'test-webhook-secret',
        'content-type': 'application/json',
      },
      payload: {
        update_id: 12345,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 987654321, type: 'private' },
          from: { id: 987654321, is_bot: false, first_name: 'Tester' },
          text: '/add Buy milk tomorrow',
          entities: [{ type: 'bot_command', offset: 0, length: 4 }],
        },
      },
    });

    expect(res.statusCode).toBe(200);

    // Give bot handler a brief moment to finish file write if async
    await new Promise((r) => setTimeout(r, 100));

    const files = fs.readdirSync(taskDir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    const content = fs.readFileSync(path.join(taskDir, files[0]), 'utf-8');
    expect(content).toContain('Buy milk');

    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Spec line 476: Atomic-write crash simulation: SIGKILL a child process in a write loop. On reload, expect no corrupted .md files. Leftover .tmp files are allowed and ignored.
  it('preserves uncorrupted .md files when writer process is killed with SIGKILL', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-atomic-crash-'));
    const taskDir = path.join(tmpDir, 'tasks');
    fs.mkdirSync(taskDir, { recursive: true });

    // Child script repeatedly writes valid markdown files atomically
    const childScript = `
      const fs = require('fs');
      const path = require('path');
      const crypto = require('crypto');

      const targetDir = ${JSON.stringify(taskDir)};

      async function run() {
        let i = 0;
        while (true) {
          const filename = 'task-' + (i % 5) + '.md';
          const target = path.join(targetDir, filename);
          const tmp = path.join(targetDir, '.' + filename + '.' + crypto.randomUUID() + '.tmp');
          const content = '---' + String.fromCharCode(10) + 'id: task-' + (i % 5) + String.fromCharCode(10) + 'title: Task ' + i + String.fromCharCode(10) + '---' + String.fromCharCode(10) + '## Description' + String.fromCharCode(10) + 'Content ' + i + String.fromCharCode(10);
          fs.writeFileSync(tmp, content, 'utf-8');
          fs.renameSync(tmp, target);
          i++;
        }
      }
      run();
    `;

    const child = spawn('node', ['-e', childScript], {
      stdio: 'ignore',
    });

    // Let the child process write for 60ms then SIGKILL it abruptly
    await new Promise((r) => setTimeout(r, 60));
    child.kill('SIGKILL');

    // Wait for child termination
    await new Promise((r) => setTimeout(r, 50));

    // Reload files through FileSystemStorageProvider and verify integrity
    const provider = new FileSystemStorageProvider(taskDir);
    const mdFiles = await provider.list('.md');

    expect(mdFiles.length).toBeGreaterThan(0);

    for (const file of mdFiles) {
      const content = await provider.read(file);
      // Every file written must have complete frontmatter and header
      expect(content).toContain('---');
      expect(content).toContain('## Description');
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
