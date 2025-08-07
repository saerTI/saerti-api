import * as remuneracionModel from '../../models/CC/remuneracionModel.mjs';

/**
 * Obtiene todas las remuneraciones con filtros opcionales y paginación
 */
async function getRemuneraciones(req, res, next) {
  try {
    // Filtros - mapear nombres para compatibilidad
    const filters = {
      search: req.query.search,
      state: req.query.state || req.query.estado,
      projectId: req.query.projectId,
      costCenterId: req.query.costCenterId || req.query.centroCostoId,
      period: req.query.period || req.query.periodo,
      area: req.query.area,
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
      employee_id: req.body.employee_id || 0,
      employee_name: req.body.nombre || req.body.employee_name,
      employee_rut: req.body.rut || req.body.employee_rut,
      employee_position: req.body.cargo || req.body.employee_position || 'No especificado',
      
      // Mapear centro de costo
      cost_center_id: req.body.costCenterId || req.body.cost_center_id,
      centro_costo_code: req.body.centroCosto || req.body.centroCostoCode,
      
      type: req.body.tipo || req.body.type,
      amount: req.body.montoTotal || req.body.amount || 
              (parseFloat(req.body.sueldoLiquido || req.body.net_salary || 0) + 
               parseFloat(req.body.anticipo || req.body.advance_payment || 0)),
      sueldo_liquido: req.body.sueldoLiquido || req.body.net_salary,
      anticipo: req.body.anticipo || req.body.advance_payment,
      date: req.body.fecha || req.body.date,
      period: (req.body.fecha || req.body.date)?.substring(0, 7),
      work_days: req.body.diasTrabajados || req.body.work_days || 30,
      payment_method: req.body.metodoPago || req.body.payment_method || 'transferencia',
      state: req.body.estado || req.body.state || 'pending', // Será mapeado en el modelo
      area: req.body.area,
      notes: req.body.notas || req.body.notes
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
    
    console.log(`Procesando ${remuneracionesData.length} remuneraciones...`);
    
    for (const [index, item] of remuneracionesData.entries()) {
      try {
        const remuneracionData = {
          employee_id: item.employee_id || 0,
          employee_name: item.nombre || item.employee_name,
          employee_rut: item.rut || item.employee_rut,
          employee_position: item.cargo || item.employee_position || 'No especificado',
          
          // Mapear centro de costo
          cost_center_id: item.costCenterId || item.cost_center_id,
          centro_costo_code: item.centroCosto || item.centroCostoCode,
          
          type: item.tipo || item.type,
          amount: item.montoTotal || item.amount || 
                  (parseFloat(item.sueldoLiquido || item.net_salary || 0) + 
                   parseFloat(item.anticipo || item.advance_payment || 0)),
          sueldo_liquido: item.sueldoLiquido || item.net_salary,
          anticipo: item.anticipo || item.advance_payment,
          date: item.fecha || item.date,
          period: (item.fecha || item.date)?.substring(0, 7),
          work_days: item.diasTrabajados || item.work_days || 30,
          payment_method: item.metodoPago || item.payment_method || 'transferencia',
          state: item.estado || item.state || 'pending', // Será mapeado en el modelo
          area: item.area,
          notes: item.notas || item.notes
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
            nombre: item.nombre || item.employee_name,
            rut: item.rut || item.employee_rut,
            centroCosto: item.centroCosto || item.centroCostoCode,
            error: error.message
          }
        });
        console.error(`Error al procesar item ${index}:`, error.message);
      }
    }
    
    res.status(201).json({
      success: true,
      message: `${createdIds.length} registros de remuneración creados exitosamente`,
      data: {
        ids: createdIds,
        created: createdIds.length,
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
      employee_name: req.body.nombre || req.body.employee_name,
      employee_rut: req.body.rut || req.body.employee_rut,
      employee_position: req.body.cargo || req.body.employee_position,
      
      // Mapear centro de costo - preservar el existente si no se proporciona uno nuevo
      cost_center_id: req.body.costCenterId || req.body.cost_center_id || existingRemuneracion.cost_center_id,
      centro_costo_code: req.body.centroCosto || req.body.centroCostoCode,
      
      // Preservar el type existente si no se proporciona uno nuevo
      type: req.body.tipo || req.body.type || existingRemuneracion.type,
      amount: req.body.montoTotal || req.body.amount || 
              (parseFloat(req.body.sueldoLiquido || req.body.net_salary || 0) + 
               parseFloat(req.body.anticipo || req.body.advance_payment || 0)),
      sueldo_liquido: req.body.sueldoLiquido || req.body.net_salary,
      anticipo: req.body.anticipo || req.body.advance_payment,
      date: req.body.fecha || req.body.date,
      period: (req.body.fecha || req.body.date)?.substring(0, 7),
      work_days: req.body.diasTrabajados || req.body.work_days || 30,
      payment_method: req.body.metodoPago || req.body.payment_method || 'transferencia',
      state: req.body.estado || req.body.state || 'pending', // Será mapeado en el modelo
      area: req.body.area,
      payment_date: req.body.payment_date,
      notes: req.body.notas || req.body.notes
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

export {
  getRemuneraciones,
  getRemuneracionById,
  createRemuneracion,
  createRemuneracionesBatch,
  updateRemuneracion,
  deleteRemuneracion,
  updateRemuneracionState
};