// src/routes/predict.routes.js
import { Router } from 'express';
import { corePredict } from '../controllers/predict.controller.js';

const router = Router();

// Endpoint: POST /predict
router.post('/predict', corePredict); 

export default router; 