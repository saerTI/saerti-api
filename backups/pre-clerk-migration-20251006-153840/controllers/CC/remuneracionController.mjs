import * as remuneracionModel from '../../models/CC/remuneracionModel.mjs';
import { empleadosModel } from '../../models/CC/empleadosModel.mjs';

/**
 * Obtiene todas las remuneraciones con filtros opcionales y paginación
 */
async function getRemuneraciones(req, res, next) {
  try {
    // Filtros - mapear nombres para compatibilidad
    const filters = {
      search: req.query.search,
      state: req.query.state || req.query.estado,
      employeeId: req.query.employeeId,
      month: req.query.month || req.query.mes,
      year: req.query.year || req.query.ano,
      period: req.query.period || req.query.periodo, // Soporte legacy para formato MM/YYYY
      rut: req.query.rut,
      type: req.query.type || req.query.tipo
    };

    // 🔥 CAMBIO CRÍTICO: Si no se especifica limit, obtener TODOS
    const pagination = {
      limit: req.query.limit ? parseInt(req.query.limit) : null, // null = SIN LÍMITE
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    // Remover filtros vacíos
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    const result = await remuneracionModel.getAll(filters, pagination);
    const stats = await remuneracionModel.getStats(filters);
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: stats,
      filters: filters
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtiene una remuneración por ID
 */
async function getRemuneracionById(req, res, next) {
  try {
    const { id } = req.params;
    const remuneracion = await remuneracionModel.getById(id);
    
    if (!remuneracion) {
      return res.status(404).json({
        success: false,
        message: 'Remuneración no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: remuneracion
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crea un nuevo registro de remuneración individual
 */
async function createRemuneracion(req, res, next) {
  try {
    const remuneracionData = {
      employee_id: req.body.employee_id,
      type: req.body.tipo || req.body.type,
      amount: req.body.amount || req.body.montoTotal,
      net_salary: req.body.net_salary || req.body.sueldoLiquido,
      advance_payment: req.body.advance_payment || req.body.anticipo,
      date: req.body.date || req.body.fecha,
      month_period: req.body.month_period || req.body.mes || (req.body.period && req.body.period.split('/')[0]),
      year_period: req.body.year_period || req.body.ano || (req.body.period && req.body.period.split('/')[1]),
      work_days: req.body.work_days || req.body.diasTrabajados || 30,
      payment_method: req.body.payment_method || req.body.metodoPago || 'transferencia',
      state: req.body.state || req.body.estado || 'pendiente',
      payment_date: req.body.payment_date || req.body.fechaPago,
      notes: req.body.notes || req.body.notas
    };
    
    const remuneracion = await remuneracionModel.create(remuneracionData);
    
    res.status(201).json({
      success: true,
      message: 'Remuneración creada exitosamente',
      data: remuneracion
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crea múltiples registros de remuneración en lote
 * Incluye lógica de creación automática de empleados por RUT
 */
async function createRemuneracionesBatch(req, res, next) {
  try {
    const remuneracionesData = req.body;
    
    if (!Array.isArray(remuneracionesData)) {
      return res.status(400).json({
        success: false,
        message: 'Se esperaba un arreglo de remuneraciones'
      });
    }
    
    const createdIds = [];
    const errorItems = [];
    const createdEmployees = [];
    
    console.log(`Procesando ${remuneracionesData.length} remuneraciones...`);
    
    for (const [index, item] of remuneracionesData.entries()) {
      try {
        let employee_id = item.employee_id;
        
        // Si no se proporciona employee_id pero sí RUT y nombre, buscar o crear empleado
        if (!employee_id && item.rut && item.nombre) {
          console.log(`Buscando empleado por RUT: ${item.rut}`);
          
          // Buscar empleado por RUT
          let employee = await remuneracionModel.findEmployeeByRut(item.rut);
          
          if (!employee) {
            console.log(`Empleado con RUT ${item.rut} no encontrado. Creando...`);
            const [firstName, ...lastNameParts] = item.nombre.split(' ');
            const newEmployeeData = {
              tax_id: item.rut,
              full_name: item.nombre,
              first_name: firstName,
              last_name: lastNameParts.join(' ') || '',
              position: item.cargo || item.position || '',
              department: item.departamento || item.department || '',
              salary_base: item.sueldoBase || item.salary_base || 0,
              active: true
            };
            
            const newEmployeeId = await empleadosModel.create(newEmployeeData);
            employee = { id: newEmployeeId, ...newEmployeeData };
            createdEmployees.push({
              id: newEmployeeId,
              rut: item.rut,
              nombre: item.nombre
            });
            console.log(`Empleado creado con ID: ${newEmployeeId}`);
          }
          
          employee_id = employee.id;
        }
        
        // Validar que tenemos un employee_id
        if (!employee_id) {
          throw new Error('Se requiere employee_id o información de RUT y nombre para crear el empleado');
        }
        
        const remuneracionData = {
          employee_id: employee_id,
          type: item.tipo || item.type || 'sueldo',
          amount: item.amount || item.montoTotal,
          net_salary: item.net_salary || item.sueldoLiquido,
          advance_payment: item.advance_payment || item.anticipo || 0,
          date: item.date || item.fecha || new Date().toISOString().split('T')[0],
          month_period: item.month_period || item.mes || new Date().getMonth() + 1,
          year_period: item.year_period || item.ano || new Date().getFullYear(),
          work_days: item.work_days || item.diasTrabajados || 30,
          payment_method: item.payment_method || item.metodoPago || 'transferencia',
          state: item.state || item.estado || 'pendiente',
          payment_date: item.payment_date || item.fechaPago,
          notes: item.notes || item.notas || `Importado desde carga masiva - ${new Date().toISOString()}`
        };
        
        const remuneracion = await remuneracionModel.create(remuneracionData);
        createdIds.push(remuneracion.id);
        
        if ((index + 1) % 50 === 0) {
          console.log(`Procesados ${index + 1}/${remuneracionesData.length} items`);
        }
      } catch (error) {
        errorItems.push({
          index,
          item: {
            rut: item.rut,
            nombre: item.nombre,
            employee_id: item.employee_id,
            tipo: item.tipo || item.type,
            error: error.message
          }
        });
        console.error(`Error al procesar item ${index}:`, error.message);
      }
    }
    
    const statusCode = errorItems.length > 0 ? 207 : 201; // 207 Multi-Status si hay errores
    
    res.status(statusCode).json({
      success: errorItems.length === 0,
      message: `Procesamiento completado: ${createdIds.length} remuneraciones creadas, ${createdEmployees.length} empleados nuevos, ${errorItems.length} errores`,
      data: {
        ids: createdIds,
        created: createdIds.length,
        createdEmployees: createdEmployees,
        errors: errorItems,
        total: remuneracionesData.length
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Actualiza una remuneración existente
 */
async function updateRemuneracion(req, res, next) {
  try {
    const { id } = req.params;
    
    // Primero obtener la remuneración existente para preservar valores críticos
    const existingRemuneracion = await remuneracionModel.getById(id);
    if (!existingRemuneracion) {
      return res.status(404).json({
        success: false,
        message: 'Remuneración no encontrada'
      });
    }
    
    const remuneracionData = {
      employee_id: req.body.employee_id || existingRemuneracion.employee_id,
      type: req.body.tipo || req.body.type || existingRemuneracion.type,
      amount: req.body.amount || req.body.montoTotal || existingRemuneracion.amount,
      net_salary: req.body.net_salary || req.body.sueldoLiquido || existingRemuneracion.net_salary,
      advance_payment: req.body.advance_payment || req.body.anticipo || existingRemuneracion.advance_payment,
      date: req.body.date || req.body.fecha || existingRemuneracion.date,
      month_period: req.body.month_period || req.body.mes || (req.body.period && req.body.period.split('/')[0]) || existingRemuneracion.month_period,
      year_period: req.body.year_period || req.body.ano || (req.body.period && req.body.period.split('/')[1]) || existingRemuneracion.year_period,
      work_days: req.body.work_days || req.body.diasTrabajados || existingRemuneracion.work_days,
      payment_method: req.body.payment_method || req.body.metodoPago || existingRemuneracion.payment_method,
      state: req.body.state || req.body.estado || existingRemuneracion.status,
      payment_date: req.body.payment_date || req.body.fechaPago || existingRemuneracion.payment_date,
      notes: req.body.notes || req.body.notas || existingRemuneracion.notes
    };
    
    const updated = await remuneracionModel.update(id, remuneracionData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Remuneración no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Remuneración actualizada exitosamente',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Elimina una remuneración
 */
async function deleteRemuneracion(req, res, next) {
  try {
    const { id } = req.params;
    
    const deleted = await remuneracionModel.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Remuneración no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Remuneración eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Actualiza el estado de una remuneración
 */
async function updateRemuneracionState(req, res, next) {
  try {
    const { id } = req.params;
    const { state } = req.body;
    
    // Mapear estados de inglés a español
    const validStatesMap = {
      'draft': 'pendiente',
      'pending': 'pendiente', 
      'approved': 'aprobado',
      'paid': 'pagado',
      'rejected': 'rechazado',
      'cancelled': 'cancelado'
    };
    
    const mappedState = validStatesMap[state] || state;
    const validStates = ['pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado'];
    
    if (!validStates.includes(mappedState)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido'
      });
    }
    
    // Obtener la remuneración actual
    const currentRemuneracion = await remuneracionModel.getById(id);
    if (!currentRemuneracion) {
      return res.status(404).json({
        success: false,
        message: 'Remuneración no encontrada'
      });
    }
    
    // Actualizar solo el estado
    const remuneracionData = {
      ...currentRemuneracion,
      state: mappedState,
      // Si se está marcando como pagado, establecer fecha de pago
      payment_date: mappedState === 'pagado' ? new Date().toISOString().split('T')[0] : currentRemuneracion.payment_date
    };
    
    const updated = await remuneracionModel.update(id, remuneracionData);
    
    res.json({
      success: true,
      message: `Estado de remuneración actualizado a ${mappedState}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Importación masiva de remuneraciones con creación automática de empleados
 */
async function importRemuneraciones(req, res, next) {
  try {
    const { remuneraciones } = req.body;

    if (!Array.isArray(remuneraciones) || remuneraciones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de remuneraciones para importar',
      });
    }

    console.log(`Iniciando importación de ${remuneraciones.length} registros de remuneración`);

    const results = {
      total: remuneraciones.length,
      success: 0,
      failed: 0,
      errors: [],
      createdEmployees: []
    };

    for (let i = 0; i < remuneraciones.length; i++) {
      const remItem = remuneraciones[i];
      try {
        // 1. Validar datos básicos del item
        if (!remItem.rut || !remItem.nombre || !remItem.tipo ||
            !remItem.monto || !remItem.mes || !remItem.año) {
          throw new Error('Datos requeridos faltantes: rut, nombre, tipo, monto, mes, año');
        }

        // 2. Buscar empleado por RUT. Si no existe, crearlo.
        let employee = await remuneracionModel.findEmployeeByRut(remItem.rut);
        if (!employee) {
          console.log(`Empleado con RUT ${remItem.rut} no encontrado. Creando...`);
          const [firstName, ...lastNameParts] = remItem.nombre.split(' ');
          const newEmployeeData = {
            tax_id: remItem.rut,
            full_name: remItem.nombre,
            first_name: firstName,
            last_name: lastNameParts.join(' ') || '',
            position: remItem.cargo || remItem.position || '',
            department: remItem.departamento || remItem.department || '',
            salary_base: remItem.sueldoBase || remItem.salary_base || remItem.monto || 0,
            active: true
          };
          
          const newEmployeeId = await empleadosModel.create(newEmployeeData);
          employee = { id: newEmployeeId, ...newEmployeeData };
          results.createdEmployees.push({
            id: newEmployeeId,
            rut: remItem.rut,
            nombre: remItem.nombre
          });
          console.log(`Empleado creado con ID: ${newEmployeeId}`);
        }

        // 3. Crear el registro de remuneración
        const remuneracionData = {
          employee_id: employee.id,
          type: remuneracionModel.mapTypeToDatabase(remItem.tipo || 'sueldo'),
          amount: remItem.monto,
          net_salary: remItem.sueldoLiquido || remItem.monto,
          advance_payment: remItem.anticipo || 0,
          date: remItem.fecha || `${remItem.año}-${String(remItem.mes).padStart(2, '0')}-01`,
          month_period: remItem.mes,
          year_period: remItem.año,
          work_days: remItem.diasTrabajados || 30,
          payment_method: remItem.metodoPago || 'transferencia',
          state: remItem.estado || 'pendiente',
          payment_date: remItem.fechaPago || null,
          notes: remItem.notas || `Importado desde carga masiva - ${new Date().toISOString()}`,
        };

        await remuneracionModel.create(remuneracionData);
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: remItem,
        });
        console.error(`Error en fila ${i + 1}:`, error.message);
      }
    }

    const statusCode = results.failed > 0 ? 207 : 200; // 207 Multi-Status si hay errores

    res.status(statusCode).json({
      success: results.failed === 0,
      message: `Importación completada: ${results.success} exitosos, ${results.failed} fallidos, ${results.createdEmployees.length} empleados creados.`,
      results,
    });

  } catch (error) {
    console.error('Error en importación masiva de remuneraciones:', error);
    next(error);
  }
}

export {
  getRemuneraciones,
  getRemuneracionById,
  createRemuneracion,
  createRemuneracionesBatch,
  updateRemuneracion,
  deleteRemuneracion,
  updateRemuneracionState,
  importRemuneraciones
};