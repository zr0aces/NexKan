import matter from 'gray-matter';
import { Note } from '@nexkan/shared';

export function parseNote(fileContent: string): Note {
  const { data, content } = matter(fileContent);
  return {
    id: data.id,
    content: content.trim(),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export function serializeNote(note: Note): string {
  return matter.stringify(`\n${note.content}\n`, {
    id: note.id,
    created_at: note.created_at,
    updated_at: note.updated_at,
  });
}
