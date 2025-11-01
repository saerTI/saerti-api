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

export default router;