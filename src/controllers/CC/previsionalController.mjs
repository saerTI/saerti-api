import { validationResult } from 'express-validator';
import previsionalModel from '../../models/CC/previsionalModel.mjs';
import { empleadosModel } from '../../models/CC/empleadosModel.mjs';

export default {
  /**
   * Crea un nuevo registro previsional
   */
  async createPrevisional(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { employee_id, cost_center_id, type, amount, date, status, payment_date, notes } = req.body;

      const dateObj = new Date(date);
      const month_period = dateObj.getMonth() + 1; // getMonth() devuelve 0-11
      const year_period = dateObj.getFullYear();

      const previsionalData = {
        employee_id,
        cost_center_id,
        type,
        amount,
        date,
        month_period,
        year_period,
        status,
        payment_date,
        notes,
      };

      const previsional = await previsionalModel.create(previsionalData);

      res.status(201).json({
        success: true,
        message: 'Registro previsional creado exitosamente',
        data: previsional,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene la lista de previsionales con filtros
   */
  async getPrevisionales(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20,
        status, // Cambiado de state
        type,   // Cambiado de category
        cost_center_id,
        month_period,
        year_period,
        start_date,
        end_date,
        search
      } = req.query;
      
      const filters = { status, type, cost_center_id, month_period, year_period, start_date, end_date, search };
      
      // Limpiar filtros nulos o indefinidos
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

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
   */
  async getPrevisionalById(req, res, next) {
    try {
      const { id } = req.params;
      const previsional = await previsionalModel.getById(id);
      
      if (!previsional) {
        return res.status(404).json({ success: false, message: 'Registro previsional no encontrado' });
      }
      
      res.json({ success: true, data: previsional });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un previsional existente
   */
  async updatePrevisional(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const previsionalData = req.body;

      // Si se actualiza la fecha, recalcular periodo
      if (previsionalData.date) {
        const dateObj = new Date(previsionalData.date);
        previsionalData.month_period = dateObj.getMonth() + 1;
        previsionalData.year_period = dateObj.getFullYear();
      }

      const updated = await previsionalModel.update(id, previsionalData);
      
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Registro no encontrado o sin cambios' });
      }
      
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
   */
  async deletePrevisional(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await previsionalModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Registro previsional no encontrado' });
      }
      
      res.json({ success: true, message: 'Registro previsional eliminado exitosamente' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el estado de un previsional
   */
  async updatePrevisionalStatus(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { status } = req.body;
      
      const updated = await previsionalModel.updateStatus(id, status);

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Registro previsional no encontrado' });
      }
      
      const updatedPrevisional = await previsionalModel.getById(id);
      
      res.json({
        success: true,
        message: 'Estado del registro previsional actualizado exitosamente',
        data: updatedPrevisional
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Importación masiva de previsionales
   */
  async importPrevisionales(req, res, next) {
    try {
      const { previsionales } = req.body;

      if (!Array.isArray(previsionales) || previsionales.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de previsionales para importar',
        });
      }

      console.log(`Iniciando importación de ${previsionales.length} registros previsionales`);

      const results = {
        total: previsionales.length,
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < previsionales.length; i++) {
        const prevItem = previsionales[i];
        try {
          // 1. Validar datos básicos del item
          if (!prevItem.rut || !prevItem.nombre || !prevItem.tipo_previsional ||
              !prevItem.centro_costo || !prevItem.monto || !prevItem.mes || !prevItem.año) {
            throw new Error('Datos requeridos faltantes en la fila.');
          }

          // 2. Buscar empleado por RUT. Si no existe, crearlo.
          let employee = await previsionalModel.findEmployeeByRut(prevItem.rut);
          if (!employee) {
            console.log(`Empleado con RUT ${prevItem.rut} no encontrado. Creando...`);
            const [firstName, ...lastNameParts] = prevItem.nombre.split(' ');
            const newEmployeeData = {
              tax_id: prevItem.rut,
              full_name: prevItem.nombre,
              first_name: firstName,
              last_name: lastNameParts.join(' ') || '',
              active: true, // Por defecto, el nuevo empleado se crea como activo
            };
            const newEmployeeId = await empleadosModel.create(newEmployeeData);
            employee = { id: newEmployeeId, ...newEmployeeData };
            console.log(`Empleado creado con ID: ${newEmployeeId}`);
          }

          // 3. Buscar centro de costo por nombre
          const costCenter = await previsionalModel.findCostCenterByName(prevItem.centro_costo);
          if (!costCenter) {
            throw new Error(`Centro de costo '${prevItem.centro_costo}' no encontrado.`);
          }

          // 4. Crear el registro previsional
          const previsionalData = {
            employee_id: employee.id,
            cost_center_id: costCenter.id,
            type: prevItem.tipo_previsional,
            amount: prevItem.monto,
            date: prevItem.fecha_pago || `${prevItem.año}-${String(prevItem.mes).padStart(2, '0')}-01`,
            month_period: prevItem.mes,
            year_period: prevItem.año,
            status: 'pendiente',
            payment_date: prevItem.fecha_pago || null,
            notes: prevItem.notas || null,
          };

          await previsionalModel.create(previsionalData);
          results.success++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: error.message,
            data: prevItem,
          });
          console.error(`Error en fila ${i + 1}:`, error.message);
        }
      }

      const statusCode = results.failed > 0 ? 207 : 200; // 207 Multi-Status si hay errores

      res.status(statusCode).json({
        success: results.failed === 0,
        message: `Importación completada: ${results.success} exitosos, ${results.failed} fallidos.`,
        results,
      });

    } catch (error) {
      console.error('Error en importación masiva:', error);
      next(error);
    }
  }
};