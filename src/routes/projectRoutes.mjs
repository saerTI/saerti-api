import { Router } from 'express';
import { body } from 'express-validator';
import projectController from '../controllers/projectController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

// ✅ ESTADOS VÁLIDOS (solo español para la DB)
const validStatuses = ['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado'];

/**
 * @route   POST /api/projects
 * @desc    Crear un nuevo proyecto
 * @access  Privado
 */
router.post(
  '/api/projects',
  authenticate,
  [
    body('name')
      .notEmpty().withMessage('El nombre del proyecto es obligatorio')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('code')
      .notEmpty().withMessage('El código del proyecto es obligatorio')
      .isLength({ min: 2, max: 20 }).withMessage('El código debe tener entre 2 y 20 caracteres'),
    // ✅ ACEPTAR AMBOS FORMATOS: camelCase Y snake_case
    body('clientId').optional().isNumeric().withMessage('ID de cliente inválido'),
    body('client_id').optional().isNumeric().withMessage('ID de cliente inválido'),
    // ✅ SOLO ESPAÑOL PARA STATUS
    body('status').optional()
      .isIn(validStatuses).withMessage(`Estado inválido. Estados permitidos: ${validStatuses.join(', ')}`),
    // ✅ FECHAS EN AMBOS FORMATOS
    body('startDate').optional().isDate().withMessage('Fecha de inicio inválida'),
    body('start_date').optional().isDate().withMessage('Fecha de inicio inválida'),
    body('expectedEndDate').optional().isDate().withMessage('Fecha de fin esperada inválida'),
    body('expected_end_date').optional().isDate().withMessage('Fecha de fin esperada inválida'),
    // ✅ PRESUPUESTO EN AMBOS FORMATOS
    body('totalBudget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('total_budget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('budget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('description').optional().isString().withMessage('Descripción inválida'),
    body('location').optional().isString().withMessage('Ubicación inválida'),
    body('location_lat').optional().isNumeric().withMessage('Latitud inválida'),
    body('location_lon').optional().isNumeric().withMessage('Longitud inválida')
  ],
  projectController.createProject
);

/**
 * @route   GET /api/projects
 * @desc    Obtener lista de proyectos
 * @access  Privado
 */
router.get(
  '/api/projects',
  authenticate,
  projectController.getProjects
);

/**
 * @route   GET /api/projects/:id
 * @desc    Obtener un proyecto por ID
 * @access  Privado
 */
router.get(
  '/api/projects/:id',
  authenticate,
  projectController.getProjectById
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Actualizar un proyecto
 * @access  Privado
 */
router.put(
  '/api/projects/:id',
  authenticate,
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('code').optional().isLength({ min: 2, max: 20 }).withMessage('El código debe tener entre 2 y 20 caracteres'),
    // ✅ ACEPTAR AMBOS FORMATOS: camelCase Y snake_case
    body('clientId').optional().isNumeric().withMessage('ID de cliente inválido'),
    body('client_id').optional().isNumeric().withMessage('ID de cliente inválido'),
    // ✅ SOLO ESPAÑOL PARA STATUS
    body('status').optional()
      .isIn(validStatuses).withMessage(`Estado inválido. Estados permitidos: ${validStatuses.join(', ')}`),
    // ✅ FECHAS EN AMBOS FORMATOS
    body('startDate').optional().isDate().withMessage('Fecha de inicio inválida'),
    body('start_date').optional().isDate().withMessage('Fecha de inicio inválida'),
    body('expectedEndDate').optional().isDate().withMessage('Fecha de fin esperada inválida'),
    body('expected_end_date').optional().isDate().withMessage('Fecha de fin esperada inválida'),
    body('actualEndDate').optional().isDate().withMessage('Fecha de fin real inválida'),
    body('actual_end_date').optional().isDate().withMessage('Fecha de fin real inválida'),
    // ✅ PRESUPUESTO EN AMBOS FORMATOS
    body('totalBudget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('total_budget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('budget').optional().isNumeric().withMessage('Presupuesto inválido'),
    body('description').optional().isString().withMessage('Descripción inválida'),
    body('location').optional().isString().withMessage('Ubicación inválida'),
    body('location_lat').optional().isNumeric().withMessage('Latitud inválida'),
    body('location_lon').optional().isNumeric().withMessage('Longitud inválida')
  ],
  projectController.updateProject
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Eliminar un proyecto
 * @access  Privado
 */
router.delete(
  '/api/projects/:id',
  authenticate,
  projectController.deleteProject
);

/**
 * @route   PATCH /api/projects/:id/status
 * @desc    Actualizar el estado de un proyecto
 * @access  Privado
 */
router.patch(
  '/api/projects/:id/status',
  authenticate,
  [
    body('status')
      .notEmpty().withMessage('El estado es obligatorio')
      // ✅ SOLO ESPAÑOL
      .isIn(validStatuses).withMessage(`Estado inválido. Estados permitidos: ${validStatuses.join(', ')}`)
  ],
  projectController.updateProjectStatus
);

/**
 * @route   GET /api/projects/status-summary
 * @desc    Obtener resumen de estados de proyectos
 * @access  Privado/Admin
 */
router.get(
  '/api/projects/status-summary',
  authenticate,
  authorize('admin'),
  projectController.getProjectStatusSummary
);

export default router;