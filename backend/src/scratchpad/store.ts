import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { parseNote, serializeNote } from './parser';
import { Note } from '@nexkan/shared';

function getDir(): string {
  return process.env.SCRATCHPAD_DIR ?? path.join(process.cwd(), 'data', 'scratchpad');
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Note ${id} not found`);
    this.name = 'NotFoundError';
  }
}

interface CacheInstance {
  cache: Map<string, Note>;
  loaded: boolean;
  watcher?: fs.FSWatcher;
}

const cacheInstances = new Map<string, CacheInstance>();

export function closeWatchers(): void {
  for (const inst of cacheInstances.values()) {
    if (inst.watcher) {
      inst.watcher.close();
    }
  }
  cacheInstances.clear();
}

function getCacheInstance(): CacheInstance {
  const dir = getDir();
  let inst = cacheInstances.get(dir);
  if (!inst) {
    inst = { cache: new Map(), loaded: false };
    cacheInstances.set(dir, inst);
  }
  return inst;
}

async function ensureCacheLoaded(): Promise<CacheInstance> {
  const dir = getDir();
  const inst = getCacheInstance();

  let files: string[] = [];
  try {
    files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md'));
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  let needsReload = !inst.loaded || files.length !== inst.cache.size;
  if (!needsReload) {
    for (const filename of files) {
      const id = filename.replace(/\.md$/, '');
      if (!id || !inst.cache.has(id)) {
        needsReload = true;
        break;
      }
    }
  }

  if (!needsReload) return inst;

  await fs.promises.mkdir(dir, { recursive: true });

  const results = await Promise.allSettled(
    files.map(f => fs.promises.readFile(path.join(dir, f), 'utf-8').then(parseNote))
  );

  inst.cache.clear();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      inst.cache.set(result.value.id, result.value);
    } else {
      console.error('Skipping corrupted scratchpad note:', result.reason);
    }
  }

  inst.loaded = true;
  setupFileWatcher(dir, inst);
  return inst;
}

function setupFileWatcher(dir: string, inst: CacheInstance): void {
  if (inst.watcher) return;

  try {
    inst.watcher = fs.watch(dir, async (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return;

      const filePath = path.join(dir, filename);
      const id = filename.replace(/\.md$/, '');
      if (!id || id.length !== 8) return;

      try {
        if (fs.existsSync(filePath)) {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const note = parseNote(content);
          inst.cache.set(id, note);
        } else {
          inst.cache.delete(id);
        }
      } catch (err) {
        // Silently skip if concurrent read/delete issues
      }
    });
    inst.watcher.unref();
  } catch (err) {
    console.error(`Failed to setup watcher for dir ${dir}:`, err);
  }
}

function validateId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{8}$/.test(id)) {
    throw new NotFoundError(id);
  }
}

export async function readAll(): Promise<Note[]> {
  const inst = await ensureCacheLoaded();
  return Array.from(inst.cache.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function readById(id: string): Promise<Note | null> {
  try {
    validateId(id);
  } catch {
    return null;
  }
  const inst = await ensureCacheLoaded();
  return inst.cache.get(id) ?? null;
}

export async function create(content: string): Promise<Note> {
  const dir = getDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const id = nanoid(8);
  const now = new Date().toISOString();
  const note: Note = { id, content, created_at: now, updated_at: now };
  await fs.promises.writeFile(path.join(dir, `${id}.md`), serializeNote(note));

  const inst = await ensureCacheLoaded();
  inst.cache.set(id, note);

  return note;
}

export async function update(id: string, content: string): Promise<Note> {
  validateId(id);
  const existing = await readById(id);
  if (!existing) throw new NotFoundError(id);
  const updated: Note = { ...existing, content, updated_at: new Date().toISOString() };
  await fs.promises.writeFile(path.join(getDir(), `${id}.md`), serializeNote(updated));

  const inst = await ensureCacheLoaded();
  inst.cache.set(id, updated);

  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  validateId(id);
  try {
    await fs.promises.unlink(path.join(getDir(), `${id}.md`));
  } catch (err: any) {
    if (err.code === 'ENOENT') throw new NotFoundError(id);
    throw err;
  }

  const inst = await ensureCacheLoaded();
  inst.cache.delete(id);
}
