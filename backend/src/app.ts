import express from 'express';
import { taskRouter } from './tasks/router';
import { noteRouter } from './scratchpad/router';
import { telegramRouter } from './telegram/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);
app.use('/api/notes', noteRouter);
app.use('/api', telegramRouter);

export default app;
