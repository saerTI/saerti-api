import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.mjs';
import { 
  getRemuneraciones,
  getRemuneracionById,
  createRemuneracion,
  createRemuneracionesBatch,
  updateRemuneracion,
  deleteRemuneracion,
  updateRemuneracionState,
  importRemuneraciones
} from '../../controllers/CC/remuneracionController.mjs';

const router = Router();

/**
 * @route   POST /api/remuneraciones
 * @desc    Crear un nuevo registro de remuneración
 * @access  Privado
 */
router.post(
  '/api/remuneraciones',
  authenticate,
  [
    body('employee_id')
      .notEmpty().withMessage('El ID del empleado es obligatorio')
      .isInt({ min: 1 }).withMessage('El ID del empleado debe ser un número válido'),
    body('type')
      .notEmpty().withMessage('El tipo es obligatorio')
      .isIn(['remuneracion', 'anticipo', 'REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('amount')
      .notEmpty().withMessage('El monto es obligatorio')
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('net_salary').optional()
      .isFloat({ min: 0 }).withMessage('El salario neto debe ser un número positivo'),
    body('advance_payment').optional()
      .isFloat({ min: 0 }).withMessage('El anticipo debe ser un número positivo'),
    body('date')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('month_period')
      .notEmpty().withMessage('El mes del período es obligatorio')
      .isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
    body('year_period')
      .notEmpty().withMessage('El año del período es obligatorio')
      .isInt({ min: 2020, max: 2050 }).withMessage('Año del período inválido'),
    body('work_days').optional()
      .isInt({ min: 1, max: 31 }).withMessage('Los días trabajados deben estar entre 1 y 31'),
    body('payment_method').optional()
      .isIn(['transferencia', 'cheque', 'efectivo']).withMessage('Método de pago no válido'),
    body('status').optional()
      .isIn(['pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado']).withMessage('Estado no válido'),
    body('payment_date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha de pago inválido (YYYY-MM-DD)'),
    body('notes').optional().isString().withMessage('Las notas deben ser texto')
  ],
  createRemuneracion
);

/**
 * @route   POST /api/remuneraciones/batch
 * @desc    Crear múltiples registros de remuneración en un solo pedido
 * @access  Privado
 */
router.post(
  '/api/remuneraciones/batch',
  authenticate,
  [
    body('*.employee_id')
      .notEmpty().withMessage('El ID del empleado es obligatorio')
      .isInt({ min: 1 }).withMessage('El ID del empleado debe ser un número válido'),
    body('*.type')
      .notEmpty().withMessage('El tipo es obligatorio')
      .isIn(['remuneracion', 'anticipo', 'REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('*.amount')
      .notEmpty().withMessage('El monto es obligatorio')
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('*.date')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('*.month_period')
      .notEmpty().withMessage('El mes del período es obligatorio')
      .isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
    body('*.year_period')
      .notEmpty().withMessage('El año del período es obligatorio')
      .isInt({ min: 2020, max: 2050 }).withMessage('Año del período inválido')
  ],
  createRemuneracionesBatch
);

/**
 * @route   GET /api/remuneraciones
 * @desc    Obtener lista de remuneraciones
 * @access  Privado
 */
router.get(
  '/api/remuneraciones',
  authenticate,
  getRemuneraciones
);

/**
 * @route   GET /api/remuneraciones/:id
 * @desc    Obtener una remuneración por ID
 * @access  Privado
 */
router.get(
  '/api/remuneraciones/:id',
  authenticate,
  getRemuneracionById
);

/**
 * @route   PUT /api/remuneraciones/:id
 * @desc    Actualizar una remuneración
 * @access  Privado
 */
router.put(
  '/api/remuneraciones/:id',
  authenticate,
  [
    body('employee_id').optional()
      .isInt({ min: 1 }).withMessage('El ID del empleado debe ser un número válido'),
    body('type').optional()
      .isIn(['remuneracion', 'anticipo', 'REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('amount').optional()
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('net_salary').optional()
      .isFloat({ min: 0 }).withMessage('El salario neto debe ser un número positivo'),
    body('advance_payment').optional()
      .isFloat({ min: 0 }).withMessage('El anticipo debe ser un número positivo'),
    body('date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('month_period').optional()
      .isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
    body('year_period').optional()
      .isInt({ min: 2020, max: 2050 }).withMessage('Año del período inválido'),
    body('work_days').optional()
      .isInt({ min: 1, max: 31 }).withMessage('Los días trabajados deben estar entre 1 y 31'),
    body('payment_method').optional()
      .isIn(['transferencia', 'cheque', 'efectivo']).withMessage('Método de pago no válido'),
    body('status').optional()
      .isIn(['pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado']).withMessage('Estado no válido'),
    body('payment_date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha de pago inválido (YYYY-MM-DD)'),
    body('notes').optional().isString().withMessage('Las notas deben ser texto')
  ],
  updateRemuneracion
);

/**
 * @route   DELETE /api/remuneraciones/:id
 * @desc    Eliminar una remuneración
 * @access  Privado
 */
router.delete(
  '/api/remuneraciones/:id',
  authenticate,
  deleteRemuneracion
);

/**
 * @route   PUT /api/remuneraciones/:id/state
 * @desc    Actualizar el estado de una remuneración
 * @access  Privado
 */
router.put(
  '/api/remuneraciones/:id/state',
  authenticate,
  [
    body('state')
      .notEmpty().withMessage('El estado es obligatorio')
      .isString().withMessage('Estado inválido')
      .isIn(['pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado', 'draft', 'pending', 'approved', 'paid', 'rejected', 'cancelled'])
      .withMessage('Estado no válido')
  ],
  updateRemuneracionState
);

/**
 * @route   POST /api/remuneraciones/import
 * @desc    Importación masiva de remuneraciones con creación automática de empleados
 * @access  Privado
 */
router.post(
  '/api/remuneraciones/import',
  authenticate,
  [
    body('remuneraciones')
      .isArray({ min: 1 }).withMessage('Se requiere un array de remuneraciones con al menos un elemento'),
    body('remuneraciones.*.rut')
      .notEmpty().withMessage('El RUT es obligatorio'),
    body('remuneraciones.*.nombre')
      .notEmpty().withMessage('El nombre del empleado es obligatorio'),
    body('remuneraciones.*.tipo')
      .notEmpty().withMessage('El tipo de remuneración es obligatorio'),
    body('remuneraciones.*.monto')
      .notEmpty().withMessage('El monto es obligatorio')
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('remuneraciones.*.mes')
      .notEmpty().withMessage('El mes es obligatorio')
      .isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
    body('remuneraciones.*.año')
      .notEmpty().withMessage('El año es obligatorio')
      .isInt({ min: 2020, max: 2050 }).withMessage('Año inválido')
  ],
  importRemuneraciones
);

export default router;