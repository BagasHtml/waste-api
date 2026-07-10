// src/routes/predict.routes.js
import { Router } from 'express';
import { corePredict, exportCSV } from '../controllers/predict.controller.js';
import { getAlerts } from '../controllers/alert.controller.js';
import { getStatus } from '../controllers/status.controller.js';
import { validateApiKey } from '../middlewares/auth.js';

const router = Router();

router.post('/predict', validateApiKey, corePredict);
router.post('/predict/csv', validateApiKey, exportCSV);
router.get('/alerts', validateApiKey ,getAlerts);
router.get('/status', validateApiKey ,getStatus);

export default router;