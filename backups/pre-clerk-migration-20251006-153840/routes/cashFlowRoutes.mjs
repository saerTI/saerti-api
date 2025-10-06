// src/routes/cashFlowRoutes.mjs - Rutas actualizadas con nuevos endpoints
import { Router } from 'express';
import { body } from 'express-validator';
import * as cashFlowController from '../controllers/cashFlowController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

/**
 * Estados válidos para flujo de caja (inglés y español)
 */
const validCashFlowStates = [
  // Estados en español (base de datos)
  'presupuestado', 'real',
  // Estados en inglés (frontend)
  'forecast', 'actual', 'budget'
];

/**
 * Tipos válidos para flujo de caja (inglés y español)
 */
const validCashFlowTypes = [
  // Tipos en español (base de datos)
  'ingreso', 'gasto', 'ambos',
  // Tipos en inglés (frontend)
  'income', 'expense', 'both'
];

// ==========================================
// NUEVAS RUTAS PRINCIPALES
// ==========================================

/**
 * @route   GET /api/cash-flow/data
 * @desc    Obtener datos principales del flujo de caja con filtros
 * @access  Privado
 */
router.get(
  '/api/cash-flow/data',
  authenticate,
  cashFlowController.getCashFlowData
);

/**
 * @route   GET /api/cash-flow/by-period
 * @desc    Obtener datos de flujo de caja agrupados por período
 * @access  Privado
 */
router.get(
  '/api/cash-flow/by-period',
  authenticate,
  cashFlowController.getCashFlowByPeriod
);

/**
 * @route   GET /api/cash-flow/filter-options
 * @desc    Obtener opciones disponibles para los filtros
 * @access  Privado
 */
router.get(
  '/api/cash-flow/filter-options',
  authenticate,
  cashFlowController.getFilterOptions
);

/**
 * @route   GET /api/cash-flow/summary
 * @desc    Obtener resumen del flujo de caja
 * @access  Privado
 */
router.get(
  '/api/cash-flow/summary',
  authenticate,
  cashFlowController.getSummary
);

// ==========================================
// RUTAS DE CATEGORÍAS
// ==========================================

/**
 * @route   GET /api/cash-flow/categories
 * @desc    Obtener categorías de flujo de caja
 * @access  Privado
 */
router.get(
  '/api/cash-flow/categories',
  authenticate,
  cashFlowController.getCategories
);

/**
 * @route   POST /api/cash-flow/categories
 * @desc    Crear una nueva categoría de flujo de caja
 * @access  Privado/Admin
 */
router.post(
  '/api/cash-flow/categories',
  authenticate,
  authorize('admin'),
  [
    body('name')
      .notEmpty().withMessage('El nombre de la categoría es obligatorio')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('type')
      .optional()
      .isIn(validCashFlowTypes).withMessage(`Tipo inválido. Tipos permitidos: ${validCashFlowTypes.join(', ')}`),
    body('parent_id').optional().isNumeric().withMessage('ID de categoría padre inválido'),
    body('active').optional().isBoolean().withMessage('Estado activo inválido')
  ],
  cashFlowController.createCategory
);

/**
 * @route   PUT /api/cash-flow/categories/:id
 * @desc    Actualizar una categoría de flujo de caja
 * @access  Privado/Admin
 */
router.put(
  '/api/cash-flow/categories/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional()
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('type').optional()
      .isIn(validCashFlowTypes).withMessage(`Tipo inválido. Tipos permitidos: ${validCashFlowTypes.join(', ')}`),
    body('parent_id').optional().isNumeric().withMessage('ID de categoría padre inválido'),
    body('active').optional().isBoolean().withMessage('Estado activo inválido')
  ],
  cashFlowController.updateCategory
);

// ==========================================
// RUTAS DE LÍNEAS DE FLUJO DE CAJA
// ==========================================

/**
 * @route   POST /api/cash-flow/lines
 * @desc    Crear una nueva línea de flujo de caja
 * @access  Privado
 */
router.post(
  '/api/cash-flow/lines',
  authenticate,
  [
    body('cost_center_id')
      .notEmpty().withMessage('El centro de costo es obligatorio')
      .isNumeric().withMessage('ID de centro de costo inválido'),
    body('name')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 3, max: 255 }).withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('category_id')
      .notEmpty().withMessage('La categoría es obligatoria')
      .isNumeric().withMessage('ID de categoría inválido'),
    body('type')
      .notEmpty().withMessage('El tipo es obligatorio')
      .isIn(validCashFlowTypes).withMessage(`Tipo inválido. Tipos permitidos: ${validCashFlowTypes.join(', ')}`),
    body('planned_date')
      .notEmpty().withMessage('La fecha planificada es obligatoria')
      .isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount')
      .notEmpty().withMessage('El monto es obligatorio')
      .isNumeric().withMessage('Monto inválido')
      .custom(value => value >= 0).withMessage('El monto debe ser positivo'),
    body('state').optional()
      .isIn(validCashFlowStates).withMessage(`Estado inválido. Estados permitidos: ${validCashFlowStates.join(', ')}`),
    body('partner_id').optional().isNumeric().withMessage('ID de socio inválido'),
    body('notes').optional().isString().withMessage('Notas inválidas')
  ],
  cashFlowController.createCashFlowLine
);

/**
 * @route   PUT /api/cash-flow/lines/:id
 * @desc    Actualizar una línea de flujo de caja
 * @access  Privado
 */
router.put(
  '/api/cash-flow/lines/:id',
  authenticate,
  [
    body('name').optional()
      .isLength({ min: 3, max: 255 }).withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('category_id').optional().isNumeric().withMessage('ID de categoría inválido'),
    body('planned_date').optional().isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount').optional()
      .isNumeric().withMessage('Monto inválido')
      .custom(value => value >= 0).withMessage('El monto debe ser positivo'),
    body('state').optional()
      .isIn(validCashFlowStates).withMessage(`Estado inválido. Estados permitidos: ${validCashFlowStates.join(', ')}`),
    body('type').optional()
      .isIn(validCashFlowTypes).withMessage(`Tipo inválido. Tipos permitidos: ${validCashFlowTypes.join(', ')}`),
    body('partner_id').optional().isNumeric().withMessage('ID de socio inválido'),
    body('notes').optional().isString().withMessage('Notas inválidas')
  ],
  cashFlowController.updateCashFlowLine
);

/**
 * @route   DELETE /api/cash-flow/lines/:id
 * @desc    Eliminar una línea de flujo de caja
 * @access  Privado
 */
router.delete(
  '/api/cash-flow/lines/:id',
  authenticate,
  cashFlowController.deleteCashFlowLine
);

// ==========================================
// RUTAS DE PROYECTOS (MANTENER COMPATIBILIDAD)
// ==========================================

/**
 * @route   GET /api/projects/:projectId/cash-flow
 * @desc    Obtener flujo de caja de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/cash-flow',
  authenticate,
  cashFlowController.getProjectCashFlow
);

/**
 * @route   GET /api/projects/:projectId/cash-flow/summary
 * @desc    Obtener resumen del flujo de caja de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/cash-flow/summary',
  authenticate,
  cashFlowController.getCashFlowSummary
);

/**
 * @route   POST /api/projects/:projectId/incomes
 * @desc    Crear un nuevo ingreso para un proyecto
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/incomes',
  authenticate,
  [
    body('name')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 3, max: 255 }).withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('category_id')
      .notEmpty().withMessage('La categoría es obligatoria')
      .isNumeric().withMessage('ID de categoría inválido'),
    body('planned_date')
      .notEmpty().withMessage('La fecha planificada es obligatoria')
      .isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount')
      .notEmpty().withMessage('El monto es obligatorio')
      .isNumeric().withMessage('Monto inválido')
      .custom(value => value >= 0).withMessage('El monto debe ser positivo'),
    body('state').optional()
      .isIn(validCashFlowStates).withMessage(`Estado inválido. Estados permitidos: ${validCashFlowStates.join(', ')}`),
    body('partner_id').optional().isNumeric().withMessage('ID de socio inválido'),
    body('notes').optional().isString().withMessage('Notas inválidas')
  ],
  cashFlowController.createIncome
);

/**
 * @route   POST /api/projects/:projectId/expenses
 * @desc    Crear un nuevo gasto para un proyecto
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/expenses',
  authenticate,
  [
    body('name')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 3, max: 255 }).withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('category_id')
      .notEmpty().withMessage('La categoría es obligatoria')
      .isNumeric().withMessage('ID de categoría inválido'),
    body('planned_date')
      .notEmpty().withMessage('La fecha planificada es obligatoria')
      .isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount')
      .notEmpty().withMessage('El monto es obligatorio')
      .isNumeric().withMessage('Monto inválido')
      .custom(value => value >= 0).withMessage('El monto debe ser positivo'),
    body('state').optional()
      .isIn(validCashFlowStates).withMessage(`Estado inválido. Estados permitidos: ${validCashFlowStates.join(', ')}`),
    body('partner_id').optional().isNumeric().withMessage('ID de socio inválido'),
    body('notes').optional().isString().withMessage('Notas inválidas')
  ],
  cashFlowController.createExpense
);

export default router;