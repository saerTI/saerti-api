import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.mjs';
import previsionalController from '../../controllers/CC/previsionalController.mjs';

const router = Router();

/**
 * @route   POST /api/previsionales
 * @desc    Crear un nuevo registro previsional
 * @access  Privado
 */
router.post(
  '/api/previsionales',
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
      .isIn(['AFP', 'Isapre', 'Isapre 7%', 'Seguro Cesantía', 'Mutual']).withMessage('Tipo no válido'),
    body('monto')
      .notEmpty().withMessage('El monto es obligatorio')
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('proyectoId')
      .optional()
      .isString().withMessage('ID de proyecto inválido'),
    body('fecha')
      .notEmpty().withMessage('La fecha es obligatoria')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('area').optional().isString().withMessage('Área inválida'),
    body('centroCosto').optional().isString().withMessage('Centro de costo inválido'),
    body('estado').optional().isString().withMessage('Estado inválido'),
    body('notas').optional().isString().withMessage('Notas inválidas')
  ],
  previsionalController.createPrevisional
);

/**
 * @route   GET /api/previsionales
 * @desc    Obtener lista de previsionales
 * @access  Privado
 */
router.get(
  '/api/previsionales',
  authenticate,
  previsionalController.getPrevisionales
);

/**
 * @route   GET /api/previsionales/:id
 * @desc    Obtener un previsional por ID
 * @access  Privado
 */
router.get(
  '/api/previsionales/:id',
  authenticate,
  previsionalController.getPrevisionalById
);

/**
 * @route   PUT /api/previsionales/:id
 * @desc    Actualizar un previsional
 * @access  Privado
 */
router.put(
  '/api/previsionales/:id',
  authenticate,
  [
    body('rut').optional()
      .isLength({ min: 3, max: 20 }).withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('nombre').optional()
      .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('tipo').optional()
      .isIn(['AFP', 'Isapre', 'Isapre 7%', 'Seguro Cesantía', 'Mutual']).withMessage('Tipo no válido'),
    body('monto').optional()
      .isFloat({ min: 0 }).withMessage('El monto debe ser un número positivo'),
    body('proyectoId').optional()
      .isString().withMessage('ID de proyecto inválido'),
    body('fecha').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('area').optional().isString().withMessage('Área inválida'),
    body('centroCosto').optional().isString().withMessage('Centro de costo inválido'),
    body('estado').optional().isString().withMessage('Estado inválido'),
    body('notas').optional().isString().withMessage('Notas inválidas')
  ],
  previsionalController.updatePrevisional
);

/**
 * @route   DELETE /api/previsionales/:id
 * @desc    Eliminar un previsional
 * @access  Privado
 */
router.delete(
  '/api/previsionales/:id',
  authenticate,
  previsionalController.deletePrevisional
);

/**
 * @route   PATCH /api/previsionales/:id/state
 * @desc    Actualizar el estado de un previsional
 * @access  Privado
 */
router.patch(
  '/api/previsionales/:id/state',
  authenticate,
  [
    body('state')
      .notEmpty().withMessage('El estado es obligatorio')
      .isString().withMessage('Estado inválido')
  ],
  previsionalController.updatePrevisionalState
);

export default router;