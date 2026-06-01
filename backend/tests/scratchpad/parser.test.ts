import { parseNote, serializeNote } from '../../src/scratchpad/parser';

const SAMPLE_MD = `---
id: abc12345
created_at: "2026-06-01T10:00:00.000Z"
updated_at: "2026-06-01T10:05:00.000Z"
---

Buy milk and call dentist
`;

describe('parseNote', () => {
  it('parses id from frontmatter', () => {
    expect(parseNote(SAMPLE_MD).id).toBe('abc12345');
  });

  it('parses timestamps from frontmatter', () => {
    const note = parseNote(SAMPLE_MD);
    expect(note.created_at).toBe('2026-06-01T10:00:00.000Z');
    expect(note.updated_at).toBe('2026-06-01T10:05:00.000Z');
  });

  it('parses body as trimmed content', () => {
    expect(parseNote(SAMPLE_MD).content).toBe('Buy milk and call dentist');
  });
});

describe('serializeNote', () => {
  it('round-trips: serialize then parse preserves all fields', () => {
    const original = parseNote(SAMPLE_MD);
    const reparsed = parseNote(serializeNote(original));
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.content).toBe(original.content);
    expect(reparsed.created_at).toBe(original.created_at);
    expect(reparsed.updated_at).toBe(original.updated_at);
  });
});
