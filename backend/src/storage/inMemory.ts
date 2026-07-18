import { StorageProvider } from './types';

export class InMemoryStorageProvider implements StorageProvider {
  private readonly files = new Map<string, string>();
  private readonly watchCallbacks = new Set<(eventType: 'change' | 'delete', filename: string) => void>();

  async list(extension?: string): Promise<string[]> {
    const keys = Array.from(this.files.keys());
    if (extension) {
      return keys.filter(k => k.endsWith(extension));
    }
    return keys;
  }

  async read(filename: string): Promise<string> {
    const content = this.files.get(filename);
    if (content === undefined) {
      const err = new Error(`ENOENT: no such file or directory, open '${filename}'`);
      (err as any).code = 'ENOENT';
      throw err;
    }
    return content;
  }

  async write(filename: string, content: string): Promise<void> {
    this.files.set(filename, content);
    this.notifyWatchers('change', filename);
  }

  async delete(filename: string): Promise<void> {
    if (!this.files.has(filename)) {
      const err = new Error(`ENOENT: no such file or directory, unlink '${filename}'`);
      (err as any).code = 'ENOENT';
      throw err;
    }
    this.files.delete(filename);
    this.notifyWatchers('delete', filename);
  }

  async exists(filename: string): Promise<boolean> {
    return this.files.has(filename);
  }

  watch(onEvent: (eventType: 'change' | 'delete', filename: string) => void): void {
    this.watchCallbacks.add(onEvent);
  }

  close(): void {
    this.watchCallbacks.clear();
  }

  clear(): void {
    this.files.clear();
    this.watchCallbacks.clear();
  }

  // Test helper to load files synchronously
  writeSync(filename: string, content: string): void {
    this.files.set(filename, content);
  }

  private notifyWatchers(eventType: 'change' | 'delete', filename: string): void {
    for (const cb of this.watchCallbacks) {
      try {
        cb(eventType, filename);
      } catch (err) {
        // Silently capture watch callback failures
      }
    }
  }
}
