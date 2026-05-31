import matter from 'gray-matter';
import { Task } from '../types/task';

export function parseTask(content: string, filename: string): Task {
  const { data, content: body } = matter(content);

  return {
    id: data.id,
    title: data.title,
    status: data.status,
    priority: data.priority,
    tags: data.tags ?? [],
    due_date: data.due_date ? String(data.due_date) : undefined,
    sort_order: data.sort_order ?? 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
    telegram_message_id: data.telegram_message_id,
    attachments: data.attachments ?? [],
    description: extractSection(body, 'Description'),
    notes: extractSection(body, 'Notes') || undefined,
  };
}

export function serializeTask(task: Task): string {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    sort_order: task.sort_order,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };

  if (task.priority !== undefined) frontmatter.priority = task.priority;
  if (task.tags.length > 0) frontmatter.tags = task.tags;
  if (task.due_date !== undefined) frontmatter.due_date = task.due_date;
  if (task.telegram_message_id !== undefined) frontmatter.telegram_message_id = task.telegram_message_id;
  if (task.attachments.length > 0) frontmatter.attachments = task.attachments;

  let body = `\n## Description\n\n${task.description}\n`;
  if (task.notes) {
    body += `\n## Notes\n\n${task.notes}\n`;
  }

  return matter.stringify(body, frontmatter);
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}
