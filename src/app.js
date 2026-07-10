// src/app.js
import express from 'express';
import cors from 'cors';
// ✅ PERBAIKAN: Tambahkan './' agar mencari dari direktori src/
import predictRouter from './routes/predict.routes.js'; 
import { getStatus } from './controllers/status.controller.js'; 

const app = express();

app.use(cors());
app.use(express.json());

app.get('/status', getStatus);
app.use('/api/v1', predictRouter);

export default app;