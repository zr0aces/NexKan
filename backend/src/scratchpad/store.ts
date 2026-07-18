import { nanoid } from 'nanoid';
import { parseNote, serializeNote } from './parser';
import { Note } from '@nexkan/shared';
import { StorageProvider } from '../storage/types';

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Note ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class NoteStore {
  private readonly cache = new Map<string, Note>();
  private loaded = false;

  constructor(private readonly storageProvider: StorageProvider) {}

  private async ensureCacheLoaded(): Promise<void> {
    if (this.loaded) return;

    let files: string[] = [];
    try {
      files = await this.storageProvider.list('.md');
    } catch (err) {
      // Ignored - empty list
    }

    const results = await Promise.allSettled(
      files.map(async filename => {
        const content = await this.storageProvider.read(filename);
        return parseNote(content);
      })
    );

    this.cache.clear();
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.cache.set(result.value.id, result.value);
      } else {
        console.error('Skipping corrupted scratchpad note:', result.reason);
      }
    }

    this.loaded = true;
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    this.storageProvider.watch(async (eventType, filename) => {
      if (!filename.endsWith('.md')) return;

      const id = filename.replace(/\.md$/, '');
      if (!id || id.length !== 8) return;

      try {
        if (await this.storageProvider.exists(filename)) {
          const content = await this.storageProvider.read(filename);
          const note = parseNote(content);
          this.cache.set(id, note);
        } else {
          this.cache.delete(id);
        }
      } catch (err) {
        // Silently skip if concurrent read/delete issues
      }
    });
  }

  private validateId(id: string): void {
    if (!/^[a-zA-Z0-9_-]{8}$/.test(id)) {
      throw new NotFoundError(id);
    }
  }

  async readAll(): Promise<Note[]> {
    await this.ensureCacheLoaded();
    return Array.from(this.cache.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async readById(id: string): Promise<Note | null> {
    try {
      this.validateId(id);
    } catch {
      return null;
    }
    await this.ensureCacheLoaded();
    return this.cache.get(id) ?? null;
  }

  async create(content: string): Promise<Note> {
    const id = nanoid(8);
    const now = new Date().toISOString();
    const note: Note = { id, content, created_at: now, updated_at: now };
    const filename = `${id}.md`;
    await this.storageProvider.write(filename, serializeNote(note));

    await this.ensureCacheLoaded();
    this.cache.set(id, note);

    return note;
  }

  async update(id: string, content: string): Promise<Note> {
    this.validateId(id);
    const existing = await this.readById(id);
    if (!existing) throw new NotFoundError(id);
    const updated: Note = { ...existing, content, updated_at: new Date().toISOString() };
    const filename = `${id}.md`;
    await this.storageProvider.write(filename, serializeNote(updated));

    await this.ensureCacheLoaded();
    this.cache.set(id, updated);

    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    this.validateId(id);
    const filename = `${id}.md`;
    try {
      await this.storageProvider.delete(filename);
    } catch (err: any) {
      if (err.code === 'ENOENT') throw new NotFoundError(id);
      throw err;
    }

    await this.ensureCacheLoaded();
    this.cache.delete(id);
  }

  close(): void {
    this.storageProvider.close();
    this.cache.clear();
    this.loaded = false;
  }
}
