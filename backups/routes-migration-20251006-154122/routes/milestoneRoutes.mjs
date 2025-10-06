import { Router } from 'express';
import { body } from 'express-validator';
import milestoneController from '../controllers/milestoneController.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = Router();

/**
 * @route   GET /api/projects/:projectId/milestones
 * @desc    Obtener todos los hitos de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/milestones',
  authenticate,
  milestoneController.getProjectMilestones
);

/**
 * @route   POST /api/projects/:projectId/milestones
 * @desc    Crear un nuevo hito para un proyecto
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/milestones',
  authenticate,
  [
    body('name')
      .notEmpty().withMessage('El nombre del hito es obligatorio')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('description').optional().isString().withMessage('Descripción inválida'),
    body('planned_date')
      .notEmpty().withMessage('La fecha planificada es obligatoria')
      .isDate().withMessage('Fecha planificada inválida'),
    body('amount').optional().isNumeric().withMessage('Monto inválido'),
    body('weight').optional().isNumeric().withMessage('Peso inválido'),
    body('sequence').optional().isInt().withMessage('Secuencia inválida')
  ],
  milestoneController.createMilestone
);

/**
 * @route   GET /api/milestones/:id
 * @desc    Obtener un hito por su ID
 * @access  Privado
 */
router.get(
  '/api/milestones/:id',
  authenticate,
  milestoneController.getMilestoneById
);

/**
 * @route   PUT /api/milestones/:id
 * @desc    Actualizar un hito
 * @access  Privado
 */
router.put(
  '/api/milestones/:id',
  authenticate,
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('description').optional().isString().withMessage('Descripción inválida'),
    body('planned_date').optional().isDate().withMessage('Fecha planificada inválida'),
    body('actual_date').optional().isDate().withMessage('Fecha real inválida'),
    body('amount').optional().isNumeric().withMessage('Monto inválido'),
    body('weight').optional().isNumeric().withMessage('Peso inválido'),
    body('is_completed').optional().isBoolean().withMessage('Estado de completado inválido'),
    body('sequence').optional().isInt().withMessage('Secuencia inválida')
  ],
  milestoneController.updateMilestone
);

/**
 * @route   DELETE /api/milestones/:id
 * @desc    Eliminar un hito
 * @access  Privado
 */
router.delete(
  '/api/milestones/:id',
  authenticate,
  milestoneController.deleteMilestone
);

/**
 * @route   PATCH /api/milestones/:id/complete
 * @desc    Marcar un hito como completado
 * @access  Privado
 */
router.patch(
  '/api/milestones/:id/complete',
  authenticate,
  [
    body('completionDate').optional().isDate().withMessage('Fecha de completado inválida')
  ],
  milestoneController.completeMilestone
);

/**
 * @route   GET /api/projects/:projectId/progress
 * @desc    Obtener el progreso de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/progress',
  authenticate,
  milestoneController.getProjectProgress
);

export default router;