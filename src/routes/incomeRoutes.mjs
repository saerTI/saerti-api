// src/routes/CC/incomeRoutes.mjs
import { Router } from 'express';
import { body } from 'express-validator';
import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';
import { 
  getIncomes,
  getIncomeById,
  createIncome,
  createIncomesBatch,
  updateIncome,
  deleteIncome,
  updateIncomeStatus,
  getIncomesByCostCenter,
  getIncomeStats
} from '../controllers/incomeController.mjs';

const router = Router();

/**
 * @route   GET /api/ingresos
 * @desc    Obtener lista paginada de ingresos con filtros
 * @access  Privado
 */
router.get(
  '/api/ingresos',
  authenticate,
  getIncomes
);

/**
 * @route   GET /api/ingresos/stats
 * @desc    Obtener estadísticas de ingresos
 * @access  Privado
 */
router.get(
  '/api/ingresos/stats',
  authenticate,
  getIncomeStats
);

/**
 * @route   GET /api/ingresos/cost-center/:costCenterId
 * @desc    Obtener ingresos por centro de costo
 * @access  Privado
 */
router.get(
  '/api/ingresos/cost-center/:costCenterId',
  authenticate,
  getIncomesByCostCenter
);

/**
 * @route   GET /api/ingresos/:id
 * @desc    Obtener un ingreso por ID
 * @access  Privado
 */
router.get(
  '/api/ingresos/:id',
  authenticate,
  getIncomeById
);

/**
 * @route   POST /api/ingresos
 * @desc    Crear un nuevo ingreso
 * @access  Privado
 */
router.post(
  '/api/ingresos',
  authenticate,
  [
    body('document_number')
      .notEmpty().withMessage('El número de documento es obligatorio')
      .isLength({ min: 1, max: 50 }).withMessage('El número de documento debe tener entre 1 y 50 caracteres'),
    body('client_name')
      .notEmpty().withMessage('El nombre del cliente es obligatorio')
      .isLength({ min: 2, max: 255 }).withMessage('El cliente debe tener entre 2 y 255 caracteres'),
    body('client_tax_id')
      .notEmpty().withMessage('El RUT del cliente es obligatorio')
      .isLength({ min: 7, max: 20 }).withMessage('El RUT debe tener entre 7 y 20 caracteres'),
    body('ep_total')
      .notEmpty().withMessage('El total EP es obligatorio')
      .isNumeric().withMessage('El total EP debe ser un número')
      .custom(value => {
        if (parseFloat(value) < 0) {
          throw new Error('El total EP no puede ser negativo');
        }
        return true;
      }),
    body('date')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('cost_center_code').optional()
      .isLength({ max: 20 }).withMessage('El código de centro de costo no puede exceder 20 caracteres'),
    body('category_id').optional()
      .isInt({ min: 1 }).withMessage('El ID de categoría debe ser un número entero positivo'),
    body('state').optional()
      .isIn(['borrador', 'activo', 'facturado', 'pagado', 'cancelado']).withMessage('Estado no válido'),
    body('description').optional()
      .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),
    body('notes').optional()
      .isLength({ max: 1000 }).withMessage('Las notas no pueden exceder 1000 caracteres')
  ],
  createIncome
);

/**
 * @route   POST /api/ingresos/batch
 * @desc    Crear múltiples ingresos en lote
 * @access  Privado
 */
router.post(
  '/api/ingresos/batch',
  authenticate,
  [
    body('*.document_number')
      .notEmpty().withMessage('El número de documento es obligatorio')
      .isLength({ min: 1, max: 50 }).withMessage('El número de documento debe tener entre 1 y 50 caracteres'),
    body('*.client_name')
      .notEmpty().withMessage('El nombre del cliente es obligatorio')
      .isLength({ min: 2, max: 255 }).withMessage('El cliente debe tener entre 2 y 255 caracteres'),
    body('*.client_tax_id')
      .notEmpty().withMessage('El RUT del cliente es obligatorio')
      .isLength({ min: 7, max: 20 }).withMessage('El RUT debe tener entre 7 y 20 caracteres'),
    body('*.ep_total')
      .notEmpty().withMessage('El total EP es obligatorio')
      .isNumeric().withMessage('El total EP debe ser un número')
      .custom(value => {
        if (parseFloat(value) < 0) {
          throw new Error('El total EP no puede ser negativo');
        }
        return true;
      }),
    body('*.date')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('*.category_id').optional()
      .isInt({ min: 1 }).withMessage('El ID de categoría debe ser un número entero positivo'),
    body('*.payment_type').optional()
      .isIn(['transferencia', 'cheque', 'efectivo', 'factoring']).withMessage('Tipo de pago no válido'),
    body('*.state').optional()
      .isIn(['borrador', 'activo', 'facturado', 'pagado', 'cancelado']).withMessage('Estado no válido')
  ],
  createIncomesBatch
);

/**
 * @route   PUT /api/ingresos/:id
 * @desc    Actualizar un ingreso
 * @access  Privado
 */
router.put(
  '/api/ingresos/:id',
  authenticate,
  [
    body('document_number').optional()
      .isLength({ min: 1, max: 50 }).withMessage('El número de documento debe tener entre 1 y 50 caracteres'),
    body('client_name').optional()
      .isLength({ min: 2, max: 255 }).withMessage('El cliente debe tener entre 2 y 255 caracteres'),
    body('client_tax_id').optional()
      .isLength({ min: 7, max: 20 }).withMessage('El RUT debe tener entre 7 y 20 caracteres'),
    body('ep_total').optional()
      .isNumeric().withMessage('El total EP debe ser un número')
      .custom(value => {
        if (value !== undefined && parseFloat(value) < 0) {
          throw new Error('El total EP no puede ser negativo');
        }
        return true;
      }),
    body('date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('category_id').optional()
      .isInt({ min: 1 }).withMessage('El ID de categoría debe ser un número entero positivo'),
    body('state').optional()
      .isIn(['borrador', 'activo', 'facturado', 'pagado', 'cancelado']).withMessage('Estado no válido'),
    body('description').optional()
      .isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres'),
    body('notes').optional()
      .isLength({ max: 1000 }).withMessage('Las notas no pueden exceder 1000 caracteres')
  ],
  updateIncome
);

/**
 * @route   PUT /api/ingresos/:id/state
 * @desc    Actualizar solo el estado de un ingreso
 * @access  Privado
 */
router.put(
  '/api/ingresos/:id/state',
  authenticate,
  [
    body('state')
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['borrador', 'activo', 'facturado', 'pagado', 'cancelado']).withMessage('Estado no válido')
  ],
  updateIncomeStatus
);

/**
 * @route   DELETE /api/ingresos/:id
 * @desc    Eliminar un ingreso
 * @access  Privado
 */
router.delete(
  '/api/ingresos/:id',
  authenticate,
  deleteIncome
);

/**
 * @route   GET /api/cost-centers
 * @desc    Obtener lista de centros de costos activos
 * @access  Privado
 */
router.get(
  '/api/cost-centers',
  authenticate,
  async (req, res) => {
    try {
      const { getCostCenters } = await import('../controllers/incomeController.mjs');
      await getCostCenters(req, res);
    } catch (error) {
      console.error('Error loading getCostCenters:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

export default router;