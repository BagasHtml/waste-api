import express from 'express';
import cors from 'cors';
import predictRouter from './routes/predict.routes.js';
import { getStatus } from './controllers/status.controller.js';
import { statusRateLimiter } from './middlewares/rateLimiter.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/status', getStatus, statusRateLimiter);

app.use('/api/v1', predictRouter);

export default app;