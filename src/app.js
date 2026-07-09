// src/app.js
import express from 'express';
import cors from 'cors';
import router from './routes/predict.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Prefix /api/v1 untuk semua route di dalam router
// Hasil akhir: POST /api/v1/predict
app.use('/api/v1', router); 

export default app;