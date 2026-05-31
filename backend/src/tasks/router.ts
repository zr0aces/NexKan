import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { readAll, readById, NotFoundError, create, update, updateStatus, updateOrder, deleteTask } from './store';
import { TaskFilters } from '../types/task';

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string()).optional(),
});

const StatusSchema = z.object({
  status: z.enum(['todo', 'in-progress', 'done']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const OrderSchema = z.object({
  position: z.number().int().min(0),
});

export const taskRouter = Router();

taskRouter.get('/', async (req: Request, res: Response) => {
  try {
    const filters: TaskFilters = {
      status: req.query.status as string | undefined,
      tags: req.query.tags as string | undefined,
      priority: req.query.priority as any,
      search: req.query.search as string | undefined,
      sort: req.query.sort as string | undefined,
      overdue: req.query.overdue === 'true',
      due_today: req.query.due_today === 'true',
      due_tomorrow: req.query.due_tomorrow === 'true',
    };
    const tasks = await readAll(filters);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await readById(req.params.id);
    if (!task) return void res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await create(parsed.data);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.put('/:id', async (req: Request, res: Response) => {
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await update(req.params.id, parsed.data);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await updateStatus(req.params.id, parsed.data.status, parsed.data.due_date);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    if (err instanceof Error && err.message.includes('due_date')) {
      return void res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.patch('/:id/order', async (req: Request, res: Response) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.flatten() });
  try {
    const task = await updateOrder(req.params.id, parsed.data.position);
    res.json(task);
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

taskRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteTask(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});
