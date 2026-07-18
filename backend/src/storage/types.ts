export interface StorageProvider {
  list(extension?: string): Promise<string[]>;
  read(filename: string): Promise<string>;
  write(filename: string, content: string): Promise<void>;
  delete(filename: string): Promise<void>;
  exists(filename: string): Promise<boolean>;
  watch(onEvent: (eventType: 'change' | 'delete', filename: string) => void): void;
  close(): void;
}
