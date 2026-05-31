import express from 'express';
import { taskRouter } from './tasks/router';
import { telegramRouter } from './telegram/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);
app.use('/api', telegramRouter);

export default app;
