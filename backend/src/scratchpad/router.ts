import { FastifyPluginAsync } from 'fastify';
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

export interface NoteRoutesOptions {
  noteStore: NoteStore;
  taskStore: TaskStore;
}

export const noteRoutes: FastifyPluginAsync<NoteRoutesOptions> = async (fastify, options) => {
  const { noteStore, taskStore } = options;
  const converter = new NoteConverter(noteStore, taskStore);

  fastify.get('/', async (_request, reply) => {
    try {
      const notes = await noteStore.readAll();
      return reply.code(200).send(notes);
    } catch {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/', async (request, reply) => {
    const parsed = ContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const note = await noteStore.create(parsed.data.content);
      return reply.code(201).send(note);
    } catch {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = ContentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const note = await noteStore.update(request.params.id, parsed.data.content);
      return reply.code(200).send(note);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await noteStore.deleteNote(request.params.id);
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post<{ Params: { id: string } }>('/:id/convert', async (request, reply) => {
    const parsed = ConvertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const task = await converter.convert(request.params.id, parsed.data);
      return reply.code(201).send(task);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      if (err instanceof Error && (err.message.includes('first line') || err.message.includes('due_date'))) {
        return reply.code(400).send({ error: err.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

