import { validationResult } from 'express-validator';
import milestoneModel from '../models/milestoneModel.mjs';
import projectModel from '../models/projectModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para gestión de hitos de proyectos
 */
export default {
  /**
   * Crea un nuevo hito para un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createMilestone(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
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
          message: 'No tienes permiso para modificar este proyecto'
        });
      }
      
      // Crear hito
      const milestoneData = {
        ...req.body,
        cost_center_id: projectId
      };
      
      const milestone = await milestoneModel.create(milestoneData);
      
      res.status(201).json({
        success: true,
        message: 'Hito creado exitosamente',
        data: milestone
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene todos los hitos de un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectMilestones(req, res, next) {
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
      
      // Obtener hitos
      const milestones = await milestoneModel.listByProject(projectId);
      
      res.json({
        success: true,
        data: milestones
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un hito por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getMilestoneById(req, res, next) {
    try {
      const { id } = req.params;
      
      const milestone = await milestoneModel.getById(id);
      
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Hito no encontrado'
        });
      }
      
      // Verificar permisos de acceso al proyecto
      const project = await projectModel.getById(milestone.cost_center_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este hito'
        });
      }
      
      res.json({
        success: true,
        data: milestone
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un hito existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateMilestone(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      
      // Verificar si el hito existe
      const milestone = await milestoneModel.getById(id);
      
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Hito no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      const project = await projectModel.getById(milestone.cost_center_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este hito'
        });
      }
      
      // Actualizar hito
      await milestoneModel.update(id, req.body);
      
      // Obtener hito actualizado
      const updatedMilestone = await milestoneModel.getById(id);
      
      res.json({
        success: true,
        message: 'Hito actualizado exitosamente',
        data: updatedMilestone
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina un hito
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteMilestone(req, res, next) {
    try {
      const { id } = req.params;
      
      // Verificar si el hito existe
      const milestone = await milestoneModel.getById(id);
      
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Hito no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      const project = await projectModel.getById(milestone.cost_center_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este hito'
        });
      }
      
      // Eliminar hito
      await milestoneModel.delete(id);
      
      res.json({
        success: true,
        message: 'Hito eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Marca un hito como completado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async completeMilestone(req, res, next) {
    try {
      const { id } = req.params;
      const { completionDate } = req.body;
      
      // Verificar si el hito existe
      const milestone = await milestoneModel.getById(id);
      
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: 'Hito no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      const project = await projectModel.getById(milestone.cost_center_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este hito'
        });
      }
      
      // Marcar como completado
      await milestoneModel.markAsCompleted(id, completionDate);
      
      // Obtener hito actualizado
      const updatedMilestone = await milestoneModel.getById(id);
      
      res.json({
        success: true,
        message: 'Hito marcado como completado exitosamente',
        data: updatedMilestone
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene el progreso de un proyecto basado en sus hitos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectProgress(req, res, next) {
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
      
      // Obtener progreso
      const progress = await milestoneModel.getProjectProgress(projectId);
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      next(error);
    }
  }
};