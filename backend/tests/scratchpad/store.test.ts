import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readAll, readById, create, update, deleteNote, NotFoundError } from '../../src/scratchpad/store';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexkan-scratchpad-test-'));
  process.env.SCRATCHPAD_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.SCRATCHPAD_DIR;
});

describe('readAll', () => {
  it('returns empty array when dir is empty', async () => {
    expect(await readAll()).toEqual([]);
  });

  it('returns notes sorted by created_at desc', async () => {
    const n1 = await create('First note');
    await new Promise(r => setTimeout(r, 5));
    const n2 = await create('Second note');
    const notes = await readAll();
    expect(notes[0].id).toBe(n2.id);
    expect(notes[1].id).toBe(n1.id);
  });
});

describe('readById', () => {
  it('returns note by id', async () => {
    const created = await create('Hello');
    const found = await readById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.content).toBe('Hello');
  });

  it('returns null for unknown id', async () => {
    expect(await readById('notexist')).toBeNull();
  });
});

describe('create', () => {
  it('creates a note with given content', async () => {
    const note = await create('Buy milk');
    expect(note.content).toBe('Buy milk');
    expect(note.id).toHaveLength(8);
    expect(note.created_at).toBeTruthy();
    expect(note.updated_at).toBeTruthy();
  });

  it('persists note as a markdown file', async () => {
    const note = await create('Test content');
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files).toContain(`${note.id}.md`);
  });
});

describe('update', () => {
  it('updates note content', async () => {
    const note = await create('Original');
    const updated = await update(note.id, 'Updated');
    expect(updated.content).toBe('Updated');
    expect(updated.id).toBe(note.id);
    expect(updated.created_at).toBe(note.created_at);
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(update('notexist', 'x')).rejects.toThrow(NotFoundError);
  });
});

describe('deleteNote', () => {
  it('removes the markdown file', async () => {
    const note = await create('To delete');
    await deleteNote(note.id);
    expect(fs.existsSync(path.join(tmpDir, `${note.id}.md`))).toBe(false);
  });

  it('throws NotFoundError for unknown id', async () => {
    await expect(deleteNote('notexist')).rejects.toThrow(NotFoundError);
  });
});
