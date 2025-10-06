import { Router } from 'express';
import reportController from '../controllers/reportController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

/**
 * @route   GET /api/reports/monthly-cash-flow/:projectId
 * @desc    Obtener reporte de flujo de caja mensual de un proyecto
 * @access  Privado
 */
router.get(
  '/api/reports/monthly-cash-flow/:projectId',
  authenticate,
  reportController.getMonthlyCashFlow
);

/**
 * @route   GET /api/reports/project-status
 * @desc    Obtener reporte de estado de todos los proyectos
 * @access  Privado
 */
router.get(
  '/api/reports/project-status',
  authenticate,
  reportController.getProjectsStatusReport
);

/**
 * @route   GET /api/reports/project-detail/:projectId
 * @desc    Obtener reporte detallado de un proyecto
 * @access  Privado
 */
router.get(
  '/api/reports/project-detail/:projectId',
  authenticate,
  reportController.getProjectDetailReport
);

export default router;