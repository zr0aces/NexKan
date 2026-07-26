import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { NoteStore, NotFoundError } from './store';
import { NoteConverter } from './converter';
import { TaskStore } from '../tasks/store';

const ContentSchema = z.object({ content: z.string().min(1) });

const ConvertSchema = z.object({
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
});

export function createNoteRouter(noteStore: NoteStore, taskStore: TaskStore): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      res.json(await noteStore.readAll());
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = ContentSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
    try {
      res.status(201).json(await noteStore.create(parsed.data.content));
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    const parsed = ContentSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
    try {
      res.json(await noteStore.update(req.params.id, parsed.data.content));
    } catch (err) {
      if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await noteStore.deleteNote(req.params.id);
      res.status(204).send();
    } catch (err) {
      if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const converter = new NoteConverter(noteStore, taskStore);

  router.post('/:id/convert', async (req: Request, res: Response) => {
    const parsed = ConvertSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
    try {
      const task = await converter.convert(req.params.id, parsed.data);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return void res.status(404).json({ error: err.message });
      }
      if (err instanceof Error && (err.message.includes('first line') || err.message.includes('due_date'))) {
        return void res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
