import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider } from './types';

export class FileSystemStorageProvider implements StorageProvider {
  private watcher?: fs.FSWatcher;

  constructor(private readonly rootDir: string) {}

  async list(extension?: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.rootDir);
      if (extension) {
        return files.filter(f => f.endsWith(extension));
      }
      return files;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async read(filename: string): Promise<string> {
    const filePath = path.join(this.rootDir, filename);
    return fs.promises.readFile(filePath, 'utf-8');
  }

  async write(filename: string, content: string): Promise<void> {
    await fs.promises.mkdir(this.rootDir, { recursive: true });
    const filePath = path.join(this.rootDir, filename);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.rootDir, filename);
    await fs.promises.unlink(filePath);
  }

  async exists(filename: string): Promise<boolean> {
    const filePath = path.join(this.rootDir, filename);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  watch(onEvent: (eventType: 'change' | 'delete', filename: string) => void): void {
    if (this.watcher) return;
    try {
      // Ensure root directory exists so watching doesn't fail immediately
      if (!fs.existsSync(this.rootDir)) {
        fs.mkdirSync(this.rootDir, { recursive: true });
      }

      this.watcher = fs.watch(this.rootDir, (eventType, filename) => {
        if (!filename) return;
        const filePath = path.join(this.rootDir, filename);
        
        // Use a small delay to handle rapid updates or write-temporary files cleanly
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              onEvent('change', filename);
            } else {
              onEvent('delete', filename);
            }
          } catch {
            onEvent('delete', filename);
          }
        }, 50);
      });
      this.watcher.unref();
    } catch (err) {
      console.error(`Failed to setup watcher for dir ${this.rootDir}:`, err);
    }
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }
}
