// src/routes/factoringRoutes.mjs
import express from 'express';
import { body, validationResult } from 'express-validator';
import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';
import {
  getAllFactorings,
  createFactoring,
  getFactoringById,
  updateFactoring,
  deleteFactoring,
  getFactoringTotalAmount
} from '../controllers/factoringController.mjs';

const router = express.Router();

/**
 * @route   GET /api/factoring
 * @desc    Obtiene todos los factorings con paginación
 * @access  Private
 * @params  ?page=1&limit=10
 */
router.get('/api/factoring', authenticate, getAllFactorings);

/**
 * @route   POST /api/factoring
 * @desc    Crea un nuevo factoring
 * @access  Private
 */
router.post(
  '/api/factoring',
  authenticate,
  [
    body('factoring_entities_id')
      .isInt({ min: 1 })
      .withMessage('El ID de la entidad de factoring debe ser un número entero positivo'),
    body('interest_rate')
      .isFloat({ min: 0, max: 100 })
      .withMessage('La tasa de interés debe ser un número entre 0 y 100'),
    body('mount')
      .isFloat({ min: 0 })
      .withMessage('El monto debe ser un número positivo'),
    body('cost_center_id')
      .isInt({ min: 1 })
      .withMessage('El ID del centro de costo debe ser un número entero positivo'),
    body('date_factoring')
      .isISO8601()
      .withMessage('La fecha de factoring debe ser una fecha válida'),
    body('date_expiration')
      .isISO8601()
      .withMessage('La fecha de vencimiento debe ser una fecha válida'),
    body('payment_status')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El estado de pago debe ser un número entero positivo'),
    body('status')
      .optional()
      .isIn(['Pendiente', 'Girado y no pagado', 'Girado y pagado'])
      .withMessage('El estado debe ser Pendiente, Girado y no pagado o Girado y pagado')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      await createFactoring(req, res);
    } catch (error) {
      console.error('Error in POST /api/factoring:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/factoring/:id
 * @desc    Obtiene un factoring por su ID
 * @access  Private
 */
router.get('/api/factoring/:id', authenticate, getFactoringById);

/**
 * @route   PUT /api/factoring/:id
 * @desc    Actualiza un factoring existente
 * @access  Private
 */
router.put(
  '/api/factoring/:id',
  authenticate,
  [
    body('factoring_entities_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('El ID de la entidad de factoring debe ser un número entero positivo'),
    body('interest_rate')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('La tasa de interés debe ser un número entre 0 y 100'),
    body('mount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('El monto debe ser un número positivo'),
    body('cost_center_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('El ID del centro de costo debe ser un número entero positivo'),
    body('date_factoring')
      .optional()
      .isISO8601()
      .withMessage('La fecha de factoring debe ser una fecha válida'),
    body('date_expiration')
      .optional()
      .isISO8601()
      .withMessage('La fecha de vencimiento debe ser una fecha válida'),
    body('payment_status')
      .optional()
      .isInt({ min: 0 })
      .withMessage('El estado de pago debe ser un número entero positivo'),
    body('status')
      .optional()
      .isIn(['Pendiente', 'Girado y no pagado', 'Girado y pagado'])
      .withMessage('El estado debe ser Pendiente, Girado y no pagado o Girado y pagado')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      await updateFactoring(req, res);
    } catch (error) {
      console.error('Error in PUT /api/factoring/:id:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/factoring/:id
 * @desc    Elimina un factoring
 * @access  Private
 */
router.delete('/api/factoring/:id', authenticate, deleteFactoring);

/**
 * @route   GET /api/factoring-total
 * @desc    Obtiene el monto total de factorings según los filtros
 * @access  Private
 */
router.get('/api/factoring-total', authenticate, getFactoringTotalAmount);

export default router;