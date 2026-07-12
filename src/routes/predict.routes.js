import { Router } from 'express';
import { corePredict, exportCSV } from '../controllers/predict.controller.js';
import { getAlerts } from '../controllers/alert.controller.js';
import { getNews } from '../controllers/news.controller.js';
import { getAutopilot } from '../controllers/autopilot.controller.js'
import { validateApiKey } from '../middlewares/auth.js';

const router = Router();

router.use(validateApiKey);

router.get('/news', getNews);
router.get('/autopilot', getAutopilot);
router.post('/predict', corePredict);
router.post('/predict/csv', exportCSV);
router.get('/alerts', getAlerts);

export default router;