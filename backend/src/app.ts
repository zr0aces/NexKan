import fastify, { FastifyInstance, FastifyError } from 'fastify';
import * as path from 'path';
import { TaskStore } from './tasks/store';
import { NoteStore } from './scratchpad/store';
import { FileSystemStorageProvider } from './storage/fileSystem';
import { noteRoutes } from './scratchpad/router';
import { taskRoutes } from './tasks/router';
import { telegramRoutes } from './telegram/router';

export function buildApp(taskStore: TaskStore, noteStore: NoteStore): FastifyInstance {
  const logLevel = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
  const app = fastify({
    bodyLimit: 10240,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
    logger: logLevel === 'silent' ? false : { level: logLevel },
    frameworkErrors: (error: FastifyError, _request: any, reply: any) => {
      if (error.code === 'FST_ERR_MAX_PARAM_LENGTH' || error.code === 'FST_ERR_BAD_URL') {
        return reply.code(404).send({ error: 'Not found' });
      }
      const status = error.statusCode || 500;
      if (status >= 500) {
        return reply.code(status).send({ error: 'Internal server error' });
      }
      return reply.code(status).send({ error: error.message });
    },
  });

  // Fastify Content-Type parsers:
  // Remove text/plain so only application/json is accepted
  app.removeContentTypeParser('text/plain');

  // Custom application/json parser to handle empty bodies with Content-Type: application/json (e.g. DELETE)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '' || body === undefined || body === null) {
      return done(null, undefined);
    }
    const bodyStr = typeof body === 'string' ? body : body.toString('utf-8');
    app.getDefaultJsonParser('error', 'error')(req, bodyStr, done);
  });

  // Framework error handler:
  // Map errors without a statusCode to 500 { error: 'Internal server error' }.
  // Framework errors (e.g. FST_ERR_*, JSON syntax) keep their statusCode and return { error: message }.
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const status = error.statusCode || 500;
    if (status >= 500) {
      return reply.code(status).send({ error: 'Internal server error' });
    }
    return reply.code(status).send({ error: error.message });
  });

  // Not found handler: returns 404 JSON
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: 'Not found' });
  });

  // Healthcheck endpoint (D5)
  app.get('/healthz', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  // Close hook for store resources
  app.addHook('onClose', async () => {
    taskStore.close();
    noteStore.close();
  });

  // Register modules
  app.register(noteRoutes, { prefix: '/api/notes', noteStore, taskStore });
  app.register(taskRoutes, { prefix: '/api/tasks', taskStore });
  app.register(telegramRoutes, { prefix: '/api', taskStore, noteStore });

  return app;
}

// Backward compatibility helper during migration phases
export function createApp(taskStore: TaskStore, noteStore: NoteStore): any {
  return buildApp(taskStore, noteStore);
}

// Production / Default exports for running the server and backward compatibility:
const getTaskDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data', 'tasks');
const getScratchpadDir = () => process.env.SCRATCHPAD_DIR || path.join(process.cwd(), 'data', 'scratchpad');

export const defaultTaskStore = new TaskStore(new FileSystemStorageProvider(getTaskDir()));
export const defaultNoteStore = new NoteStore(new FileSystemStorageProvider(getScratchpadDir()));

export const defaultApp = buildApp(defaultTaskStore, defaultNoteStore);
export default defaultApp;
