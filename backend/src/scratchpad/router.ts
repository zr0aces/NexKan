import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { readAll, readById, create, update, deleteNote, NotFoundError } from './store';
import { create as createTask } from '../tasks/store';

const ContentSchema = z.object({ content: z.string().min(1) });

const ConvertSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
});

export const noteRouter = Router();

noteRouter.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await readAll());
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.post('/', async (req: Request, res: Response) => {
  const parsed = ContentSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.status(201).json(await create(parsed.data.content));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = ContentSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    res.json(await update(req.params.id, parsed.data.content));
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteNote(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

noteRouter.post('/:id/convert', async (req: Request, res: Response) => {
  const parsed = ConvertSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const note = await readById(req.params.id);
    if (!note) return void res.status(404).json({ error: `Note ${req.params.id} not found` });

    const lines = note.content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(1).join('\n').trim() || undefined;

    const task = await createTask({
      title,
      description,
      due_date: parsed.data.due_date,
      priority: parsed.data.priority,
      status: parsed.data.status ?? 'todo',
    });
    await deleteNote(req.params.id);
    res.status(201).json(task);
  } catch (err) {
    if (err instanceof Error && err.message.includes('due_date')) {
      return void res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
