// src/routes/CC/multidimensionalRoutes.mjs
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.mjs';
import { 
  exploreCosts,
  getCostsDimensions,
  drillDownCostCenter,
  drillDownCategory,
  getExecutiveSummary,
  getQuickStats,
  getHealthCheck,
  getCostsByPeriod,
  debugCostsData
} from '../../controllers/CC/multidimensionalController.mjs';

const router = Router();

// ==========================================
// RUTAS PRINCIPALES - NAVEGACIÓN MULTIDIMENSIONAL
// ==========================================

/**
 * @route   GET /api/costs/explore
 * @desc    Navegación multidimensional con filtros tipo ecommerce
 * @access  Privado
 * @example /api/costs/explore?transaction_type=gasto&cost_center_type=proyecto&page=1&limit=25
 */
router.get('/api/costs/explore', authenticate, exploreCosts);

/**
 * @route   GET /api/costs/dimensions
 * @desc    Obtiene todas las dimensiones disponibles para filtros dinámicos
 * @access  Privado
 * @example /api/costs/dimensions?transaction_type=gasto
 */
router.get('/api/costs/dimensions', authenticate, getCostsDimensions);

/**
 * @route   GET /api/costs/by-period
 * @desc    Datos de costos agrupados por categoría y período para tabla financiera
 * @access  Privado
 * @example /api/costs/by-period?period_type=monthly&year=2024&cost_center_id=123
 */
router.get('/api/costs/by-period', authenticate, getCostsByPeriod);

/**
 * @route   GET /api/costs/debug
 * @desc    Debug: Verificar qué datos hay en cada tabla fuente
 * @access  Privado
 */
router.get('/api/costs/debug', authenticate, debugCostsData);

/**
 * @route   GET /api/costs/drill-down/cost-center/:id
 * @desc    Análisis detallado de un centro de costo específico
 * @access  Privado
 * @example /api/costs/drill-down/cost-center/123
 */
router.get('/api/costs/drill-down/cost-center/:id', authenticate, drillDownCostCenter);

/**
 * @route   GET /api/costs/drill-down/category/:id
 * @desc    Análisis detallado de una categoría contable específica
 * @access  Privado
 * @example /api/costs/drill-down/category/456
 */
router.get('/api/costs/drill-down/category/:id', authenticate, drillDownCategory);

/**
 * @route   GET /api/costs/executive-summary
 * @desc    Resumen ejecutivo multidimensional
 * @access  Privado
 * @example /api/costs/executive-summary
 */
router.get('/api/costs/executive-summary', authenticate, getExecutiveSummary);

/**
 * @route   GET /api/costs/quick-stats
 * @desc    Estadísticas rápidas para dashboard
 * @access  Privado
 * @example /api/costs/quick-stats?period_year=2024&period_month=6
 */
router.get('/api/costs/quick-stats', authenticate, getQuickStats);

/**
 * @route   GET /api/costs/health
 * @desc    Verificar salud del sistema multidimensional
 * @access  Privado
 */
router.get('/api/costs/health', authenticate, getHealthCheck);

export default router;