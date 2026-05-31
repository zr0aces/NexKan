import { Router, Request, Response } from 'express';
import { readAll, readById, NotFoundError } from './store';
import { TaskFilters } from '../types/task';

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
