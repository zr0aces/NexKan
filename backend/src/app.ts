import express from 'express';
import { taskRouter } from './tasks/router';

const app = express();
app.use(express.json());
app.use('/api/tasks', taskRouter);

export default app;
