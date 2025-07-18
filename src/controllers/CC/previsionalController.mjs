import { validationResult } from 'express-validator';
import { AppError } from '../../middleware/errorHandler.mjs';
import previsionalModel from '../../models/CC/previsionalModel.mjs';

/**
 * Controlador para gestión de pagos previsionales
 */
export default {
  /**
   * Crea un nuevo registro previsional
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createPrevisional(req, res, next) {
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
      
      // Preparar datos para inserción en la base de datos
      const previsionalData = {
        employee_id: req.body.employee_id || 0, // Placeholder, en producción se debería validar
        employee_name: req.body.nombre,
        employee_rut: req.body.rut,
        cost_center_id: req.body.proyectoId || null,
        type: req.body.tipo,
        amount: req.body.monto,
        date: req.body.fecha,
        period: req.body.fecha, // Formato MM/YYYY
        state: req.body.estado || 'pending',
        area: req.body.area || null,
        centro_costo: req.body.centroCosto || null,
        notes: req.body.notas || null
      };
      
      const previsional = await previsionalModel.create(previsionalData);
      
      res.status(201).json({
        success: true,
        message: 'Registro previsional creado exitosamente',
        data: previsional
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene la lista de previsionales con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getPrevisionales(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20,
        state,
        category,
        cost_center_id,
        period,
        area,
        centro_costo,
        start_date,
        end_date,
        min_amount,
        max_amount,
        search
      } = req.query;
      
      // Construir filtros
      const filters = {};
      
      // Aplicar filtros
      if (state) filters.state = state;
      if (category) filters.category = category;
      if (cost_center_id) filters.cost_center_id = cost_center_id;
      if (period) {
        // Si period viene como string, convertirlo a array
        filters.period = typeof period === 'string' ? [period] : period;
      }
      if (area) filters.area = area;
      if (centro_costo) filters.centro_costo = centro_costo;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (min_amount) filters.min_amount = parseFloat(min_amount);
      if (max_amount) filters.max_amount = parseFloat(max_amount);
      if (search) filters.search = search;
      
      const previsionales = await previsionalModel.list(filters, page, limit);
      
      res.json({
        success: true,
        data: previsionales.data,
        pagination: previsionales.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un previsional por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getPrevisionalById(req, res, next) {
    try {
      const { id } = req.params;
      
      const previsional = await previsionalModel.getById(id);
      
      if (!previsional) {
        return res.status(404).json({
          success: false,
          message: 'Registro previsional no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: previsional
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un previsional existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updatePrevisional(req, res, next) {
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
      
      // Verificar si el previsional existe
      const existingPrevisional = await previsionalModel.getById(id);
      
      if (!existingPrevisional) {
        return res.status(404).json({
          success: false,
          message: 'Registro previsional no encontrado'
        });
      }
      
      // Preparar datos para actualización
      const previsionalData = {};
      
      if (req.body.rut) previsionalData.employee_rut = req.body.rut;
      if (req.body.nombre) previsionalData.employee_name = req.body.nombre;
      if (req.body.tipo) previsionalData.type = req.body.tipo;
      if (req.body.monto) previsionalData.amount = req.body.monto;
      if (req.body.proyectoId) previsionalData.cost_center_id = req.body.proyectoId;
      if (req.body.fecha) {
        previsionalData.date = req.body.fecha;
        previsionalData.period = req.body.fecha;
      }
      if (req.body.area) previsionalData.area = req.body.area;
      if (req.body.centroCosto) previsionalData.centro_costo = req.body.centroCosto;
      if (req.body.estado) previsionalData.state = req.body.estado;
      if (req.body.notas) previsionalData.notes = req.body.notas;
      
      // Actualizar previsional
      const updated = await previsionalModel.update(id, previsionalData);
      
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo actualizar el registro previsional'
        });
      }
      
      // Obtener previsional actualizado
      const updatedPrevisional = await previsionalModel.getById(id);
      
      res.json({
        success: true,
        message: 'Registro previsional actualizado exitosamente',
        data: updatedPrevisional
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina un previsional
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deletePrevisional(req, res, next) {
    try {
      const { id } = req.params;
      
      // Verificar si el previsional existe
      const existingPrevisional = await previsionalModel.getById(id);
      
      if (!existingPrevisional) {
        return res.status(404).json({
          success: false,
          message: 'Registro previsional no encontrado'
        });
      }
      
      // Eliminar previsional
      await previsionalModel.delete(id);
      
      res.json({
        success: true,
        message: 'Registro previsional eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el estado de un previsional
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updatePrevisionalState(req, res, next) {
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
      const { state } = req.body;
      
      if (!state) {
        return res.status(400).json({
          success: false,
          message: 'El estado es requerido'
        });
      }
      
      // Verificar si el previsional existe
      const existingPrevisional = await previsionalModel.getById(id);
      
      if (!existingPrevisional) {
        return res.status(404).json({
          success: false,
          message: 'Registro previsional no encontrado'
        });
      }
      
      // Actualizar estado
      await previsionalModel.updateState(id, state);
      
      // Obtener previsional actualizado
      const updatedPrevisional = await previsionalModel.getById(id);
      
      res.json({
        success: true,
        message: 'Estado del registro previsional actualizado exitosamente',
        data: updatedPrevisional
      });
    } catch (error) {
      next(error);
    }
  }
};