// src/routes/factoringEntityRoutes.mjs
import express from 'express';
import { body, validationResult } from 'express-validator';
import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';
import { getAllFactoringEntities, createFactoringEntity } from '../controllers/factoringEntityController.mjs';

const router = express.Router();

/**
 * @route   GET /api/factoring-entities
 * @desc    Obtiene todas las entidades de factoring
 * @access  Private
 */
router.get('/api/factoring-entities', authenticate, getAllFactoringEntities);

/**
 * @route   POST /api/factoring-entities
 * @desc    Crea una nueva entidad de factoring
 * @access  Private
 */
router.post(
  '/api/factoring-entities',
  authenticate,
  [
    body('name')
      .notEmpty()
      .withMessage('El nombre de la entidad es requerido')
      .isString()
      .withMessage('El nombre debe ser un texto')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres')
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
      await createFactoringEntity(req, res);
    } catch (error) {
      console.error('Error in POST /api/factoring-entities:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
);

export default router;