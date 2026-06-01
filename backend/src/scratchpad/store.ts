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

export async function readAll(): Promise<Note[]> {
  const dir = getDir();
  try {
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md'));
    const notes = await Promise.all(
      files.map(f => fs.promises.readFile(path.join(dir, f), 'utf-8').then(parseNote))
    );
    return notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readById(id: string): Promise<Note | null> {
  try {
    const content = await fs.promises.readFile(path.join(getDir(), `${id}.md`), 'utf-8');
    return parseNote(content);
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function create(content: string): Promise<Note> {
  const dir = getDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const id = nanoid(8);
  const now = new Date().toISOString();
  const note: Note = { id, content, created_at: now, updated_at: now };
  await fs.promises.writeFile(path.join(dir, `${id}.md`), serializeNote(note));
  return note;
}

export async function update(id: string, content: string): Promise<Note> {
  const existing = await readById(id);
  if (!existing) throw new NotFoundError(id);
  const updated: Note = { ...existing, content, updated_at: new Date().toISOString() };
  await fs.promises.writeFile(path.join(getDir(), `${id}.md`), serializeNote(updated));
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await fs.promises.unlink(path.join(getDir(), `${id}.md`));
  } catch (err: any) {
    if (err.code === 'ENOENT') throw new NotFoundError(id);
    throw err;
  }
}
