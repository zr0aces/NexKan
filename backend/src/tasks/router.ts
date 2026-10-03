import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TaskStore, NotFoundError } from './store';
import { TaskService } from './service';
import { TaskFilters } from '@nexkan/shared';

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

interface TaskQuery {
  status?: string;
  tags?: string;
  priority?: string;
  search?: string;
  sort?: string;
  overdue?: string;
  due_today?: string;
  due_tomorrow?: string;
}

export interface TaskRoutesOptions {
  taskStore: TaskStore;
}

export const taskRoutes: FastifyPluginAsync<TaskRoutesOptions> = async (fastify, options) => {
  const { taskStore } = options;
  const taskService = new TaskService(taskStore);

  fastify.get<{ Querystring: TaskQuery }>('/', async (request, reply) => {
    try {
      const query = request.query;
      const filters: TaskFilters = {
        status: query.status as string | undefined,
        tags: query.tags as string | undefined,
        priority: query.priority as any,
        search: query.search as string | undefined,
        sort: query.sort as string | undefined,
        overdue: query.overdue === 'true',
        due_today: query.due_today === 'true',
        due_tomorrow: query.due_tomorrow === 'true',
      };
      const tasks = await taskService.listTasks(filters);
      return reply.code(200).send(tasks);
    } catch {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const task = await taskService.getTask(request.params.id);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
      }
      return reply.code(200).send(task);
    } catch {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/', async (request, reply) => {
    const parsed = CreateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const task = await taskService.createTask(parsed.data);
      return reply.code(201).send(task);
    } catch (err) {
      if (err instanceof Error && err.message.includes('due_date')) {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = UpdateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const task = await taskService.updateTask(request.params.id, parsed.data);
      return reply.code(200).send(task);
    } catch (err) {
      if (err instanceof NotFoundError || (err instanceof Error && err.message.includes('not found'))) {
        return reply.code(404).send({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('due_date')) {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/:id/status', async (request, reply) => {
    const parsed = StatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const task = await taskService.updateTaskStatus(request.params.id, parsed.data.status, parsed.data.due_date);
      return reply.code(200).send(task);
    } catch (err) {
      if (err instanceof NotFoundError || (err instanceof Error && err.message.includes('not found'))) {
        return reply.code(404).send({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('due_date')) {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/:id/order', async (request, reply) => {
    const parsed = OrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const task = await taskService.updateOrder(request.params.id, parsed.data.position);
      return reply.code(200).send(task);
    } catch (err) {
      if (err instanceof NotFoundError || (err instanceof Error && err.message.includes('not found'))) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await taskService.deleteTask(request.params.id);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof NotFoundError || (err instanceof Error && err.message.includes('not found'))) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
