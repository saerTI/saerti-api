import { validationResult } from 'express-validator';
import remuneracionModel from '../../models/CC/remuneracionModel.mjs';
import { AppError } from '../../middleware/errorHandler.mjs';

/**
 * Controlador para gestión de remuneraciones
 */
export default {
  /**
   * Crea un nuevo registro de remuneración
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createRemuneracion(req, res, next) {
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
      const remuneracionData = {
        employee_id: req.body.employee_id || 0, // Placeholder, en producción se debería validar
        employee_name: req.body.nombre,
        employee_rut: req.body.rut,
        employee_position: req.body.cargo || 'No especificado',
        project_id: req.body.proyectoId || null,
        type: req.body.tipo,
        sueldo_liquido: req.body.sueldoLiquido || null,
        anticipo: req.body.anticipo || null,
        date: req.body.fecha,
        period: req.body.fecha.substring(0, 7), // Formato YYYY-MM
        work_days: req.body.diasTrabajados || 30,
        payment_method: req.body.metodoPago || 'transfer',
        state: req.body.estado || 'pending'
      };
      
      const remuneracion = await remuneracionModel.create(remuneracionData);
      
      res.status(201).json({
        success: true,
        message: 'Registro de remuneración creado exitosamente',
        data: remuneracion
      });
    } catch (error) {
      next(error);
    }
  },
    /**
   * Crea múltiples registros de remuneración en lote
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createRemuneracionesBatch(req, res, next) {
    try {
      const remuneracionesData = req.body;
      
      if (!Array.isArray(remuneracionesData)) {
        return res.status(400).json({
          success: false,
          message: 'Se esperaba un arreglo de remuneraciones'
        });
      }
      
      // Array para almacenar IDs creados
      const createdIds = [];
      const errorItems = [];
      
      // Log para depuración
      console.log('Datos recibidos para batch:', JSON.stringify(remuneracionesData.slice(0, 2)));
      
      // Procesar cada remuneración
      for (const [index, item] of remuneracionesData.entries()) {
        try {
          // Convertir datos al formato del modelo
          const remuneracionData = {
            employee_id: item.employee_id || 0,
            employee_name: item.nombre,
            employee_rut: item.rut,
            employee_position: item.cargo || 'No especificado',
            project_id: item.proyectoId || null,
            project_name: item.centroCostoNombre || '', // Usar campo del frontend
            project_code: item.centroCosto || '',       // Usar campo del frontend
            type: item.tipo,
            amount: item.montoTotal || (item.sueldoLiquido || 0) + (item.anticipo || 0), // Usar el monto total enviado o calcularlo
            sueldo_liquido: item.sueldoLiquido || null,
            anticipo: item.anticipo || null,
            date: item.fecha,
            period: item.fecha.substring(0, 7), // Formato YYYY-MM
            work_days: item.diasTrabajados || 30,
            payment_method: item.metodoPago || 'transfer',
            state: item.estado || 'pending',
            area: item.area || null // Añadir área si está disponible
          };
          
          // Log para depuración
          if (index === 0) {
            console.log('Primer ítem procesado:', remuneracionData);
          }
          
          // Crear remuneración
          const remuneracion = await remuneracionModel.create(remuneracionData);
          createdIds.push(remuneracion.id);
        } catch (error) {
          // Registrar error pero continuar con el resto
          errorItems.push({
            index,
            item,
            error: error.message
          });
          console.error(`Error al procesar item ${index}:`, error);
        }
      }
      
      // Devolver resultado
      res.status(201).json({
        success: true,
        message: `${createdIds.length} registros de remuneración creados exitosamente`,
        data: {
          ids: createdIds,
          errors: errorItems.length > 0 ? errorItems : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene la lista de remuneraciones con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getRemuneraciones(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10,
        state,
        employee_position,
        project_id,
        period,
        date_from,
        date_to,
        search
      } = req.query;
      
      // Construir filtros
      const filters = {};
      
      // Aplicar filtros
      if (state) filters.state = state;
      if (employee_position) filters.employee_position = employee_position;
      if (project_id) filters.project_id = project_id;
      if (period) {
        // Si period viene como string, convertirlo a array
        filters.period = typeof period === 'string' ? [period] : period;
      }
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;
      if (search) filters.search = search;
      
      const remuneraciones = await remuneracionModel.list(filters, page, limit);
      
      res.json({
        success: true,
        data: remuneraciones.data,
        pagination: remuneraciones.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene una remuneración por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getRemuneracionById(req, res, next) {
    try {
      const { id } = req.params;
      
      const remuneracion = await remuneracionModel.getById(id);
      
      if (!remuneracion) {
        return res.status(404).json({
          success: false,
          message: 'Registro de remuneración no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: remuneracion
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza una remuneración existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateRemuneracion(req, res, next) {
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
      
      // Verificar si la remuneración existe
      const existingRemuneracion = await remuneracionModel.getById(id);
      
      if (!existingRemuneracion) {
        return res.status(404).json({
          success: false,
          message: 'Registro de remuneración no encontrado'
        });
      }
      
      // Preparar datos para actualización
      const remuneracionData = {};
      
      if (req.body.rut) remuneracionData.employee_rut = req.body.rut;
      if (req.body.nombre) remuneracionData.employee_name = req.body.nombre;
      if (req.body.cargo) remuneracionData.employee_position = req.body.cargo;
      if (req.body.tipo) remuneracionData.type = req.body.tipo;
      if (req.body.sueldoLiquido) remuneracionData.sueldo_liquido = req.body.sueldoLiquido;
      if (req.body.anticipo) remuneracionData.anticipo = req.body.anticipo;
      if (req.body.proyectoId) remuneracionData.project_id = req.body.proyectoId;
      if (req.body.fecha) {
        remuneracionData.date = req.body.fecha;
        remuneracionData.period = req.body.fecha.substring(0, 7); // Formato YYYY-MM
      }
      if (req.body.diasTrabajados) remuneracionData.work_days = req.body.diasTrabajados;
      if (req.body.metodoPago) remuneracionData.payment_method = req.body.metodoPago;
      if (req.body.estado) remuneracionData.state = req.body.estado;
      
      // Actualizar remuneración
      const updated = await remuneracionModel.update(id, remuneracionData);
      
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo actualizar el registro de remuneración'
        });
      }
      
      // Obtener remuneración actualizada
      const updatedRemuneracion = await remuneracionModel.getById(id);
      
      res.json({
        success: true,
        message: 'Registro de remuneración actualizado exitosamente',
        data: updatedRemuneracion
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina una remuneración
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteRemuneracion(req, res, next) {
    try {
      const { id } = req.params;
      
      // Verificar si la remuneración existe
      const existingRemuneracion = await remuneracionModel.getById(id);
      
      if (!existingRemuneracion) {
        return res.status(404).json({
          success: false,
          message: 'Registro de remuneración no encontrado'
        });
      }
      
      // Eliminar remuneración
      await remuneracionModel.delete(id);
      
      res.json({
        success: true,
        message: 'Registro de remuneración eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el estado de una remuneración
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateRemuneracionState(req, res, next) {
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
      
      // Verificar si la remuneración existe
      const existingRemuneracion = await remuneracionModel.getById(id);
      
      if (!existingRemuneracion) {
        return res.status(404).json({
          success: false,
          message: 'Registro de remuneración no encontrado'
        });
      }
      
      // Actualizar estado
      await remuneracionModel.updateState(id, state);
      
      // Obtener remuneración actualizada
      const updatedRemuneracion = await remuneracionModel.getById(id);
      
      res.json({
        success: true,
        message: 'Estado del registro de remuneración actualizado exitosamente',
        data: updatedRemuneracion
      });
    } catch (error) {
      next(error);
    }
  }
};