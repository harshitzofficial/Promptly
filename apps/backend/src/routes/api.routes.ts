import express from 'express';
import { optimizeStream } from '../controllers/optimize.ctrl.js';
import { getPricingApi, updatePricingApi, trackApi, getSessionApi, getStatsApi, logCacheApi, logCustomApi } from '../controllers/stats.ctrl.js';

const router = express.Router();

router.post('/optimize/stream', optimizeStream);
router.get('/pricing', getPricingApi);
router.post('/pricing', updatePricingApi);
router.post('/track', trackApi);
router.get('/session/:sessionId', getSessionApi);
router.get('/stats', getStatsApi);
router.post('/log-cache', logCacheApi);
router.post('/log-custom', logCustomApi);

export default router;
