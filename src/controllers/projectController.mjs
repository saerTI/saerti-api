import { validationResult } from 'express-validator';
import projectModel from '../models/projectModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para gestión de proyectos de construcción
 */
export default {
  /**
   * Crea un nuevo proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createProject(req, res, next) {
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
      
      // Establecer al usuario actual como propietario
      const projectData = {
        ...req.body,
        owner_id: req.user.id
      };
      
      const project = await projectModel.create(projectData);
      
      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        data: project
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene la lista de proyectos con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjects(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20,
        status,
        search,
        start_date_from,
        start_date_to
      } = req.query;
      
      // Construir filtros
      const filters = {};
      
      // Si no es admin, solo mostrar proyectos del usuario
      if (req.user.role !== 'admin') {
        filters.owner_id = req.user.id;
      }
      
      // Aplicar filtros adicionales
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (start_date_from) filters.start_date_from = start_date_from;
      if (start_date_to) filters.start_date_to = start_date_to;
      
      const projects = await projectModel.listProjects(filters, page, limit);
      
      res.json({
        success: true,
        data: projects.data,
        pagination: projects.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un proyecto por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectById(req, res, next) {
    try {
      const { id } = req.params;
      
      const project = await projectModel.getById(id);
      
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
      
      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un proyecto existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateProject(req, res, next) {
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
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este proyecto'
        });
      }
      
      // Actualizar proyecto
      const updated = await projectModel.update(id, req.body);
      
      // Obtener proyecto actualizado
      const updatedProject = await projectModel.getById(id);
      
      res.json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        data: updatedProject
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteProject(req, res, next) {
    try {
      const { id } = req.params;
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este proyecto'
        });
      }
      
      // Eliminar proyecto
      await projectModel.delete(id);
      
      res.json({
        success: true,
        message: 'Proyecto eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el estado de un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateProjectStatus(req, res, next) {
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
      const { status } = req.body;
      
      if (!status || !['draft', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Estado no válido'
        });
      }
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este proyecto'
        });
      }
      
      // Actualizar estado
      await projectModel.updateStatus(id, status);
      
      // Obtener proyecto actualizado
      const updatedProject = await projectModel.getById(id);
      
      res.json({
        success: true,
        message: 'Estado del proyecto actualizado exitosamente',
        data: updatedProject
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene el resumen de estados de todos los proyectos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectStatusSummary(req, res, next) {
    try {
      const summary = await projectModel.getProjectStatusSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
};