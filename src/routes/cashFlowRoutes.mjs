import { Router } from 'express';
import { body } from 'express-validator';
import cashFlowController from '../controllers/cashFlowController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

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
      .isIn(['income', 'expense', 'both']).withMessage('Tipo inválido'),
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
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('type').optional().isIn(['income', 'expense', 'both']).withMessage('Tipo inválido'),
    body('parent_id').optional().isNumeric().withMessage('ID de categoría padre inválido'),
    body('active').optional().isBoolean().withMessage('Estado activo inválido')
  ],
  cashFlowController.updateCategory
);

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
    body('state').optional().isIn(['forecast', 'actual']).withMessage('Estado inválido'),
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
    body('state').optional().isIn(['forecast', 'actual']).withMessage('Estado inválido'),
    body('partner_id').optional().isNumeric().withMessage('ID de socio inválido'),
    body('notes').optional().isString().withMessage('Notas inválidas')
  ],
  cashFlowController.createExpense
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
    body('name').optional().isLength({ min: 3, max: 255 }).withMessage('El nombre debe tener entre 3 y 255 caracteres'),
    body('category_id').optional().isNumeric().withMessage('ID de categoría inválido'),
    body('planned_date').optional().isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount').optional().isNumeric().withMessage('Monto inválido').custom(value => value >= 0).withMessage('El monto debe ser positivo'),
    body('state').optional().isIn(['forecast', 'actual']).withMessage('Estado inválido'),
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

export default router;