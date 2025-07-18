// src/routes/CC/multidimensionalRoutes.mjs
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.mjs';
import multidimensionalController from '../../controllers/CC/multidimensionalController.mjs';

const router = Router();

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN PARA TODAS LAS RUTAS
// ==========================================
router.use(authenticate);

// ==========================================
// RUTAS PRINCIPALES - NAVEGACIÓN MULTIDIMENSIONAL
// ==========================================

/**
 * @route   GET /api/costs/explore
 * @desc    Navegación multidimensional con filtros tipo ecommerce
 * @access  Privado
 * @example /api/costs/explore?transaction_type=gasto&cost_center_type=proyecto&page=1&limit=25
 */
router.get('/explore', multidimensionalController.exploreCosts);

/**
 * @route   GET /api/costs/dimensions
 * @desc    Obtiene todas las dimensiones disponibles para filtros dinámicos
 * @access  Privado
 * @example /api/costs/dimensions?transaction_type=gasto
 */
router.get('/dimensions', multidimensionalController.getDimensions);

// ==========================================
// RUTAS DE DRILL-DOWN ESPECÍFICO
// ==========================================

/**
 * @route   GET /api/costs/drill-down/cost-center/:id
 * @desc    Análisis detallado de un centro de costo específico
 * @access  Privado
 * @example /api/costs/drill-down/cost-center/123
 */
router.get('/drill-down/cost-center/:id', multidimensionalController.drillDownCostCenter);

/**
 * @route   GET /api/costs/drill-down/category/:id
 * @desc    Análisis detallado de una categoría contable específica
 * @access  Privado
 * @example /api/costs/drill-down/category/456
 */
router.get('/drill-down/category/:id', multidimensionalController.drillDownCategory);

// ==========================================
// RUTAS DE RESÚMENES Y ESTADÍSTICAS
// ==========================================

/**
 * @route   GET /api/costs/executive-summary
 * @desc    Resumen ejecutivo multidimensional
 * @access  Privado
 * @example /api/costs/executive-summary
 */
router.get('/executive-summary', multidimensionalController.getExecutiveSummary);

/**
 * @route   GET /api/costs/quick-stats
 * @desc    Estadísticas rápidas para dashboard
 * @access  Privado
 * @example /api/costs/quick-stats?period_year=2024&period_month=6
 */
router.get('/quick-stats', multidimensionalController.getQuickStats);

/**
 * @route   GET /api/costs/compare
 * @desc    Comparar diferentes dimensiones (centros, categorías, etc.)
 * @access  Privado
 * @example /api/costs/compare?dimension=cost_center_id&values=1,2,3
 */
router.get('/compare', multidimensionalController.compareDimensions);

// ==========================================
// RUTAS ADICIONALES DE ANÁLISIS
// ==========================================

/**
 * @route   GET /api/costs/trends
 * @desc    Análisis de tendencias temporales
 * @access  Privado
 * @example /api/costs/trends?cost_center_id=123&months=12
 */
router.get('/trends', async (req, res, next) => {
  try {
    // Implementación básica usando el controlador existente
    const filters = {
      cost_center_id: req.query.cost_center_id ? parseInt(req.query.cost_center_id) : undefined,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
      transaction_type: req.query.transaction_type
    };

    // Filtrar campos undefined
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const pagination = { page: 1, limit: 1000 }; // Obtener muchos datos para análisis

    // Usar el controlador de exploración para obtener datos de tendencias
    req.query = { ...filters, sort: 'date_asc', ...pagination };
    await multidimensionalController.exploreCosts(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/costs/export
 * @desc    Exportar datos filtrados a CSV
 * @access  Privado
 * @example /api/costs/export?transaction_type=gasto&format=csv
 */
router.get('/export', async (req, res, next) => {
  try {
    // TODO: Implementar exportación a CSV/Excel
    res.status(501).json({
      success: false,
      message: 'Funcionalidad de exportación en desarrollo',
      available_formats: ['csv', 'excel', 'pdf']
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// RUTAS DE UTILIDAD
// ==========================================

/**
 * @route   GET /api/costs/health
 * @desc    Verificar salud del sistema multidimensional
 * @access  Privado
 */
router.get('/health', async (req, res) => {
  try {
    // Verificar que la vista multidimensional existe
    const { pool } = await import('../../config/database.mjs');
    
    await pool.query('SELECT 1 FROM multidimensional_costs_view LIMIT 1');
    
    res.json({
      success: true,
      message: 'Sistema multidimensional funcionando correctamente',
      timestamp: new Date().toISOString(),
      components: {
        database_view: 'OK',
        routes: 'OK',
        controller: 'OK',
        model: 'OK'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en sistema multidimensional',
      error: error.message,
      suggestion: 'Verificar que la vista multidimensional_costs_view existe en la base de datos'
    });
  }
});

export default router;