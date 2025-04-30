import cashFlowModel from '../models/cashFlowModel.mjs';
import projectModel from '../models/projectModel.mjs';
import milestoneModel from '../models/milestoneModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para generación de reportes
 */
export default {
  /**
   * Genera un reporte de flujo de caja mensual para un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getMonthlyCashFlow(req, res, next) {
    try {
      const { projectId } = req.params;
      const { year = new Date().getFullYear() } = req.query;
      
      // Verificar si el proyecto existe
      const project = await projectModel.getById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este proyecto'
        });
      }
      
      // Obtener datos de flujo de caja mensual
      const monthlyCashFlow = await cashFlowModel.getMonthlyCashFlow(projectId, year);
      
      res.json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            code: project.code
          },
          year,
          monthlyCashFlow
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Genera un reporte del estado general de todos los proyectos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectsStatusReport(req, res, next) {
    try {
      // Obtener resumen de estados de proyectos
      const statusSummary = await projectModel.getProjectStatusSummary();
      
      // Filtrar proyectos si no es administrador
      const filters = {};
      if (req.user.role !== 'admin') {
        filters.owner_id = req.user.id;
      }
      
      // Obtener lista de proyectos activos (en progreso)
      filters.status = 'in_progress';
      const activeProjects = await projectModel.listProjects(filters, 1, 100);
      
      // Obtener progreso para cada proyecto activo
      const projectsWithProgress = await Promise.all(
        activeProjects.data.map(async (project) => {
          const progress = await milestoneModel.getProjectProgress(project.id);
          const cashSummary = await cashFlowModel.getCashFlowSummary(project.id);
          
          return {
            id: project.id,
            name: project.name,
            code: project.code,
            start_date: project.start_date,
            expected_end_date: project.expected_end_date,
            budget: project.total_budget,
            progress: {
              milestones: progress,
              financials: {
                budget: project.total_budget,
                spent: cashSummary.actual_expense || 0,
                remaining: project.total_budget - (cashSummary.actual_expense || 0),
                budgetPercentage: project.total_budget > 0 
                  ? ((cashSummary.actual_expense || 0) / project.total_budget) * 100 
                  : 0
              }
            }
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          summary: statusSummary,
          activeProjects: projectsWithProgress
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Genera un reporte detallado de un proyecto específico
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectDetailReport(req, res, next) {
    try {
      const { projectId } = req.params;
      
      // Verificar si el proyecto existe
      const project = await projectModel.getById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este proyecto'
        });
      }
      
      // Obtener datos relacionados
      const milestones = await milestoneModel.listByProject(projectId);
      const cashFlow = await cashFlowModel.getProjectCashFlow(projectId);
      const cashSummary = await cashFlowModel.getCashFlowSummary(projectId);
      const progress = await milestoneModel.getProjectProgress(projectId);
      
      // Calcular días transcurridos y restantes
      const today = new Date();
      const startDate = project.start_date ? new Date(project.start_date) : null;
      const endDate = project.expected_end_date ? new Date(project.expected_end_date) : null;
      
      let daysElapsed = null;
      let daysRemaining = null;
      let timeProgress = null;
      
      if (startDate && endDate) {
        if (today >= startDate) {
          daysElapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
          daysRemaining = Math.max(0, Math.floor((endDate - today) / (1000 * 60 * 60 * 24)));
          
          const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
          timeProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
        }
      }
      
      res.json({
        success: true,
        data: {
          project,
          timeMetrics: {
            daysElapsed,
            daysRemaining,
            timeProgress
          },
          progressMetrics: {
            milestonesProgress: progress.progressPercentage,
            budgetProgress: project.total_budget > 0 
              ? ((cashSummary.actual_expense || 0) / project.total_budget) * 100 
              : 0
          },
          financials: {
            summary: cashSummary,
            cashFlow: cashFlow.slice(0, 20) // Limitar a los 20 más recientes para el reporte
          },
          milestones: {
            completed: milestones.filter(m => m.is_completed),
            pending: milestones.filter(m => !m.is_completed)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};