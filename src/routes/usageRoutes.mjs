// src/routes/usageRoutes.mjs
import express from 'express';
import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';
import { getUserUsageStats } from '../controllers/usageStatsController.mjs';

const router = express.Router();

/**
 * @route   GET /api/usage/stats
 * @desc    Obtener estadísticas de uso del usuario
 * @access  Privado
 * @query   service - 'budget-analyzer' o 'cash-flow'
 */
router.get('/usage/stats', authenticate, getUserUsageStats);

/**
 * @route   GET /api/usage/health
 * @desc    Health check del servicio de métricas
 * @access  Público
 */
router.get('/usage/health', (req, res) => {
  res.json({
    success: true,
    service: 'Usage Metrics API',
    status: 'healthy',
    supported_services: ['budget-analyzer', 'cash-flow'],
    timestamp: new Date().toISOString()
  });
});

export default router;