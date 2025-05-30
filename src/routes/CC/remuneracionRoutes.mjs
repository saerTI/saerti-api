import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.mjs';
import remuneracionController from '../../controllers/CC/remuneracionController.mjs';

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
    body('rut')
      .notEmpty().withMessage('El RUT es obligatorio')
      .isLength({ min: 3, max: 20 }).withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('nombre')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('tipo')
      .notEmpty().withMessage('El tipo es obligatorio')
      .isIn(['REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('sueldoLiquido')
      .if(body('tipo').equals('REMUNERACION'))
      .notEmpty().withMessage('El sueldo líquido es obligatorio para remuneraciones')
      .isFloat({ min: 0 }).withMessage('El sueldo líquido debe ser un número positivo'),
    body('anticipo')
      .if(body('tipo').equals('ANTICIPO'))
      .notEmpty().withMessage('El anticipo es obligatorio para anticipos')
      .isFloat({ min: 0 }).withMessage('El anticipo debe ser un número positivo'),
    body('proyectoId')
      .notEmpty().withMessage('El proyecto es obligatorio')
      .isString().withMessage('ID de proyecto inválido'),
    body('fecha')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('estado').optional().isString().withMessage('Estado inválido'),
    body('cargo').optional().isString().withMessage('Cargo inválido'),
    body('diasTrabajados').optional().isInt({ min: 1, max: 31 }).withMessage('Días trabajados inválidos'),
    body('metodoPago').optional().isString().withMessage('Método de pago inválido')
  ],
  remuneracionController.createRemuneracion
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
    body('*.rut')
      .notEmpty().withMessage('El RUT es obligatorio')
      .isLength({ min: 3, max: 20 }).withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('*.nombre')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('*.tipo')
      .notEmpty().withMessage('El tipo es obligatorio')
      .isIn(['REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('*.fecha')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)')
  ],
  remuneracionController.createRemuneracionesBatch
);

/**
 * @route   GET /api/remuneraciones
 * @desc    Obtener lista de remuneraciones
 * @access  Privado
 */
router.get(
  '/api/remuneraciones',
  authenticate,
  remuneracionController.getRemuneraciones
);

/**
 * @route   GET /api/remuneraciones/:id
 * @desc    Obtener una remuneración por ID
 * @access  Privado
 */
router.get(
  '/api/remuneraciones/:id',
  authenticate,
  remuneracionController.getRemuneracionById
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
    body('rut').optional()
      .isLength({ min: 3, max: 20 }).withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('nombre').optional()
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('tipo').optional()
      .isIn(['REMUNERACION', 'ANTICIPO']).withMessage('Tipo no válido'),
    body('sueldoLiquido').optional()
      .isFloat({ min: 0 }).withMessage('El sueldo líquido debe ser un número positivo'),
    body('anticipo').optional()
      .isFloat({ min: 0 }).withMessage('El anticipo debe ser un número positivo'),
    body('proyectoId').optional()
      .isString().withMessage('ID de proyecto inválido'),
    body('fecha').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('estado').optional().isString().withMessage('Estado inválido'),
    body('cargo').optional().isString().withMessage('Cargo inválido'),
    body('diasTrabajados').optional().isInt({ min: 1, max: 31 }).withMessage('Días trabajados inválidos'),
    body('metodoPago').optional().isString().withMessage('Método de pago inválido')
  ],
  remuneracionController.updateRemuneracion
);

/**
 * @route   DELETE /api/remuneraciones/:id
 * @desc    Eliminar una remuneración
 * @access  Privado
 */
router.delete(
  '/api/remuneraciones/:id',
  authenticate,
  remuneracionController.deleteRemuneracion
);

/**
 * @route   PATCH /api/remuneraciones/:id/state
 * @desc    Actualizar el estado de una remuneración
 * @access  Privado
 */
router.patch(
  '/api/remuneraciones/:id/state',
  authenticate,
  [
    body('state')
      .notEmpty().withMessage('El estado es obligatorio')
      .isString().withMessage('Estado inválido')
  ],
  remuneracionController.updateRemuneracionState
);

export default router;