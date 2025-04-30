import { validationResult } from 'express-validator';
import cashFlowModel from '../models/cashFlowModel.mjs';
import projectModel from '../models/projectModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para gestión de flujo de caja
 */
export default {
  /**
   * Obtiene las categorías de flujo de caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getCategories(req, res, next) {
    try {
      const { type, activeOnly = 'true' } = req.query;
      
      const categories = await cashFlowModel.getCategories(
        type,
        activeOnly === 'true'
      );
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Crea una nueva categoría de flujo de caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createCategory(req, res, next) {
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
      
      const category = await cashFlowModel.createCategory(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        data: category
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza una categoría de flujo de caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateCategory(req, res, next) {
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
      
      const updated = await cashFlowModel.updateCategory(id, req.body);
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }
      
      res.json({
        success: true,
        message: 'Categoría actualizada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene el flujo de caja de un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectCashFlow(req, res, next) {
    try {
      const { projectId } = req.params;
      const { type, state, from_date, to_date } = req.query;
      
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
      
      // Construir filtros
      const filters = {};
      if (type) filters.type = type;
      if (state) filters.state = state;
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      
      // Obtener flujo de caja
      const cashFlow = await cashFlowModel.getProjectCashFlow(projectId, filters);
      
      res.json({
        success: true,
        data: cashFlow
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Crea un nuevo ingreso para un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createIncome(req, res, next) {
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
      
      // Crear línea de ingreso
      const lineData = {
        ...req.body,
        project_id: projectId,
        type: 'income'
      };
      
      const income = await cashFlowModel.createLine(lineData);
      
      res.status(201).json({
        success: true,
        message: 'Ingreso registrado exitosamente',
        data: income
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Crea un nuevo gasto para un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createExpense(req, res, next) {
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
      
      // Crear línea de gasto
      const lineData = {
        ...req.body,
        project_id: projectId,
        type: 'expense'
      };
      
      const expense = await cashFlowModel.createLine(lineData);
      
      res.status(201).json({
        success: true,
        message: 'Gasto registrado exitosamente',
        data: expense
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza una línea de flujo de caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateCashFlowLine(req, res, next) {
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
      
      // Obtener la línea actual para verificar permisos
      const [lines] = await cashFlowModel.getProjectCashFlow({}, { id });
      
      if (lines.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Línea de flujo de caja no encontrada'
        });
      }
      
      const line = lines[0];
      
      // Verificar permisos de acceso al proyecto
      const project = await projectModel.getById(line.project_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este registro'
        });
      }
      
      // No permitir cambiar el tipo de transacción
      if (req.body.type && req.body.type !== line.type) {
        return res.status(400).json({
          success: false,
          message: 'No se puede cambiar el tipo de transacción (ingreso/gasto)'
        });
      }
      
      // Actualizar línea
      await cashFlowModel.updateLine(id, req.body);
      
      res.json({
        success: true,
        message: 'Registro actualizado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina una línea de flujo de caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteCashFlowLine(req, res, next) {
    try {
      const { id } = req.params;
      
      // Obtener la línea actual para verificar permisos
      const [lines] = await cashFlowModel.getProjectCashFlow({}, { id });
      
      if (lines.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Línea de flujo de caja no encontrada'
        });
      }
      
      const line = lines[0];
      
      // Verificar permisos de acceso al proyecto
      const project = await projectModel.getById(line.project_id);
      
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este registro'
        });
      }
      
      // Eliminar línea
      await cashFlowModel.deleteLine(id);
      
      res.json({
        success: true,
        message: 'Registro eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un resumen del flujo de caja de un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getCashFlowSummary(req, res, next) {
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
      
      // Obtener resumen
      const summary = await cashFlowModel.getCashFlowSummary(projectId);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
};