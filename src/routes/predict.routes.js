import { Router } from 'express';
import { corePredict, exportCSV } from '../controllers/predict.controller.js';
import { getAlerts } from '../controllers/alert.controller.js';
import { getNews } from '../controllers/news.controller.js';
import { getAutopilot } from '../controllers/autopilot.controller.js'
import { validateApiKey } from '../middlewares/auth.js';
import { aiRateLimiter, generalRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.use(validateApiKey);

router.get('/news', getNews, generalRateLimiter);
router.get('/autopilot', getAutopilot, aiRateLimiter);
router.post('/predict', corePredict, aiRateLimiter);
router.post('/predict/csv', exportCSV, aiRateLimiter);
router.get('/alerts', getAlerts, generalRateLimiter);

export default router;