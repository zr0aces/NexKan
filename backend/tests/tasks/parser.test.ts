import { parseTask, serializeTask } from '../../src/tasks/parser';
import { Task } from '../../src/types/task';

const SAMPLE_MD = `---
id: a3f9k2mw
title: Buy groceries
status: todo
priority: high
tags:
  - shopping
  - personal
due_date: "2026-06-01"
sort_order: 3
created_at: "2026-05-15T10:30:00Z"
updated_at: "2026-05-16T08:00:00Z"
telegram_message_id: 98765
attachments:
  - receipts/jan2024.pdf
---

## Description

Buy milk, eggs, bread from the market.

## Notes

Check discount aisle for olive oil.
`;

describe('parseTask', () => {
  it('parses all frontmatter fields', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.id).toBe('a3f9k2mw');
    expect(task.title).toBe('Buy groceries');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('high');
    expect(task.tags).toEqual(['shopping', 'personal']);
    expect(task.due_date).toBe('2026-06-01');
    expect(task.sort_order).toBe(3);
    expect(task.created_at).toBe('2026-05-15T10:30:00Z');
    expect(task.updated_at).toBe('2026-05-16T08:00:00Z');
    expect(task.telegram_message_id).toBe(98765);
    expect(task.attachments).toEqual(['receipts/jan2024.pdf']);
  });

  it('parses description from body', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.description).toBe('Buy milk, eggs, bread from the market.');
  });

  it('parses notes from body', () => {
    const task = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    expect(task.notes).toBe('Check discount aisle for olive oil.');
  });

  it('defaults optional arrays to empty', () => {
    const minimalMd = `---
id: x1y2z3w4
title: Minimal task
status: plan
sort_order: 1
created_at: "2026-05-01T00:00:00Z"
updated_at: "2026-05-01T00:00:00Z"
---

## Description

Just a task.
`;
    const task = parseTask(minimalMd, 'x1y2z3w4-minimal-task.md');
    expect(task.tags).toEqual([]);
    expect(task.attachments).toEqual([]);
    expect(task.notes).toBeUndefined();
    expect(task.priority).toBeUndefined();
  });
});

describe('serializeTask', () => {
  it('round-trips a task through serialize → parse', () => {
    const original = parseTask(SAMPLE_MD, 'a3f9k2mw-buy-groceries.md');
    const serialized = serializeTask(original);
    const reparsed = parseTask(serialized, 'a3f9k2mw-buy-groceries.md');
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.title).toBe(original.title);
    expect(reparsed.status).toBe(original.status);
    expect(reparsed.tags).toEqual(original.tags);
    expect(reparsed.due_date).toBe(original.due_date);
    expect(reparsed.description).toBe(original.description);
    expect(reparsed.notes).toBe(original.notes);
  });

  it('omits undefined optional fields from frontmatter', () => {
    const minimalMd = `---
id: x1y2z3w4
title: Minimal task
status: plan
sort_order: 1
created_at: "2026-05-01T00:00:00Z"
updated_at: "2026-05-01T00:00:00Z"
---

## Description

Just a task.
`;
    const task = parseTask(minimalMd, 'x1y2z3w4-minimal-task.md');
    const serialized = serializeTask(task);
    expect(serialized).not.toContain('priority:');
    expect(serialized).not.toContain('due_date:');
    expect(serialized).not.toContain('notes:');
  });
});
