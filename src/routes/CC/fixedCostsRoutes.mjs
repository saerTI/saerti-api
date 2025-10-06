// src/routes/CC/fixedCostsRoutes.mjs

import { Router } from 'express';
import { body } from 'express-validator';
import { clerkAuth as authenticate } from '../../middleware/clerkAuth.mjs';
import { 
  getFixedCosts,
  getFixedCostById,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  updatePaidQuotas,
  getFixedCostsByCostCenter,
  getFixedCostsStats
} from '../../controllers/CC/fixedCostsController.mjs';

const router = Router();

// ✅ ENDPOINT PRINCIPAL CON TODOS LOS FILTROS
/**
 * @route   GET /api/costos-fijos
 * @desc    Get fixed costs with filters and pagination
 * @access  Private
 * @params  ?search=texto&state=active&costCenterId=1&categoryId=2
 *          &startDate=2024-01-01&endDate=2024-12-31&paymentStatus=active
 *          &limit=25&offset=0
 */
router.get('/api/costos-fijos', authenticate, getFixedCosts);

// ✅ ENDPOINT PARA ESTADÍSTICAS CON FILTROS
/**
 * @route   GET /api/costos-fijos/stats
 * @desc    Get fixed costs statistics with same filters
 * @access  Private
 */
router.get('/api/costos-fijos/stats', authenticate, getFixedCostsStats);

// ✅ ENDPOINT POR ID
/**
 * @route   GET /api/costos-fijos/:id
 * @desc    Get fixed cost by ID
 * @access  Private
 */
router.get('/api/costos-fijos/:id', authenticate, getFixedCostById);

// ✅ CREAR NUEVO COSTO FIJO
/**
 * @route   POST /api/costos-fijos
 * @desc    Create new fixed cost
 * @access  Private
 */
router.post('/api/costos-fijos', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('quota_value').isFloat({ min: 0.01 }).withMessage('Quota value must be greater than 0'),
    body('quota_count').isInt({ min: 1 }).withMessage('Quota count must be at least 1'),
    body('start_date').isISO8601().withMessage('Valid start date is required')
  ],
  createFixedCost
);

// ✅ ACTUALIZAR COSTO FIJO
/**
 * @route   PUT /api/costos-fijos/:id
 * @desc    Update fixed cost
 * @access  Private
 */
router.put('/api/costos-fijos/:id', authenticate, updateFixedCost);

// ✅ ELIMINAR COSTO FIJO
/**
 * @route   DELETE /api/costos-fijos/:id
 * @desc    Delete fixed cost
 * @access  Private
 */
router.delete('/api/costos-fijos/:id', authenticate, deleteFixedCost);

// ✅ ACTUALIZAR CUOTAS PAGADAS
/**
 * @route   PUT /api/costos-fijos/:id/paid-quotas
 * @desc    Update paid quotas for a fixed cost
 * @access  Private
 */
router.put('/api/costos-fijos/:id/paid-quotas', 
  authenticate,
  [
    body('paid_quotas').isInt({ min: 0 }).withMessage('Paid quotas must be a non-negative integer')
  ],
  updatePaidQuotas
);

// ✅ COSTOS FIJOS POR CENTRO DE COSTO
/**
 * @route   GET /api/costos-fijos/cost-center/:costCenterId
 * @desc    Get fixed costs by cost center
 * @access  Private
 */
router.get('/api/costos-fijos/cost-center/:costCenterId', authenticate, getFixedCostsByCostCenter);

export default router;

// ========================================
// NOTA: AGREGAR AL ARCHIVO PRINCIPAL
// ========================================

// No olvides agregar estas líneas en src/app.mjs:
// import fixedCostsRoutes from './routes/CC/fixedCostsRoutes.mjs';
// app.use(fixedCostsRoutes);