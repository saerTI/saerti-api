import { Router } from 'express';
import { body, param } from 'express-validator';
import { clerkAuth as authenticate } from '../../middleware/clerkAuth.mjs';
import previsionalController from '../../controllers/CC/previsionalController.mjs';

const router = Router();

// Middleware de validación base
const previsionalValidationRules = [
  body('employee_id').notEmpty().withMessage('El ID del empleado es obligatorio').isNumeric(),
  body('type').notEmpty().isIn(['afp', 'isapre', 'isapre_7', 'seguro_cesantia', 'mutual']).withMessage('Tipo no válido'),
  body('amount').notEmpty().isDecimal({ decimal_digits: '2' }).withMessage('El monto debe ser un número decimal'),
  body('date').notEmpty().isISO8601().toDate().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
  body('status').optional().isIn(['pendiente', 'pagado', 'cancelado']).withMessage('Estado no válido'),
  body('payment_date').optional().isISO8601().toDate().withMessage('Formato de fecha de pago inválido'),
  body('notes').optional().isString()
];

// POST /api/previsionales - Crear
router.post(
  '/api/previsionales',
  authenticate,
  previsionalValidationRules,
  previsionalController.createPrevisional
);

// GET /api/previsionales - Listar
router.get(
  '/api/previsionales',
  authenticate,
  previsionalController.getPrevisionales
);

// GET /api/previsionales/:id - Obtener por ID
router.get(
  '/api/previsionales/:id',
  authenticate,
  [param('id').isNumeric().withMessage('El ID debe ser un número')],
  previsionalController.getPrevisionalById
);

// PUT /api/previsionales/:id - Actualizar
router.put(
  '/api/previsionales/:id',
  authenticate,
  [
    param('id').isNumeric().withMessage('El ID debe ser un número'),
    // Validaciones opcionales para la actualización
    body('employee_id').optional().isNumeric(),
    body('type').optional().isIn(['afp', 'isapre', 'isapre_7', 'seguro_cesantia', 'mutual']),
    body('amount').optional().isDecimal({ decimal_digits: '2' }),
    body('date').optional().isISO8601().toDate(),
    body('status').optional().isIn(['pendiente', 'pagado', 'cancelado']),
    body('payment_date').optional().isISO8601().toDate(),
    body('notes').optional().isString()
  ],
  previsionalController.updatePrevisional
);

// DELETE /api/previsionales/:id - Eliminar
router.delete(
  '/api/previsionales/:id',
  authenticate,
  [param('id').isNumeric().withMessage('El ID debe ser un número')],
  previsionalController.deletePrevisional
);

// PATCH /api/previsionales/:id/status - Actualizar estado
router.patch(
  '/api/previsionales/:id/status',
  authenticate,
  [
    param('id').isNumeric().withMessage('El ID debe ser un número'),
    body('status')
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['pendiente', 'pagado', 'cancelado']).withMessage('Estado no válido')
  ],
  previsionalController.updatePrevisionalStatus
);

// POST /api/previsionales/import - Importación masiva
router.post(
  '/api/previsionales/import',
  authenticate,
  [
    body('previsionales')
      .isArray({ min: 1 }).withMessage('Se requiere un array de previsionales con al menos un elemento'),
    body('previsionales.*.rut')
      .notEmpty().withMessage('El RUT es obligatorio'),
    body('previsionales.*.nombre')
      .notEmpty().withMessage('El nombre es obligatorio'),
    body('previsionales.*.tipo_previsional')
      .isIn(['afp', 'isapre', 'isapre_7', 'fonasa', 'seguro_cesantia', 'mutual'])
      .withMessage('Tipo previsional no válido'),
    body('previsionales.*.monto')
      .isNumeric().withMessage('El monto debe ser numérico'),
    body('previsionales.*.mes')
      .isInt({ min: 1, max: 12 }).withMessage('El mes debe ser entre 1 y 12'),
    body('previsionales.*.año')
      .isInt({ min: 2020, max: 2030 }).withMessage('El año debe ser válido'),
    body('previsionales.*.fecha_pago')
      .optional().isISO8601().withMessage('Formato de fecha de pago inválido'),
    body('previsionales.*.notas')
      .optional().isString()
  ],
  previsionalController.importPrevisionales
);

export default router;