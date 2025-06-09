import * as remuneracionModel from '../../models/CC/remuneracionModel.mjs';

/**
 * Obtiene todas las remuneraciones con filtros opcionales y paginación
 */
async function getRemuneraciones(req, res, next) {
  try {
    // Filtros
    const filters = {
      search: req.query.search, // 🆕 Búsqueda general (nombre)
      state: req.query.state,
      projectId: req.query.projectId,
      period: req.query.period,
      area: req.query.area,
      rut: req.query.rut, // 🆕 Búsqueda por RUT
      type: req.query.type // 🆕 Filtro por tipo
    };

    // 🆕 Parámetros de paginación
    const pagination = {
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    // Remover filtros vacíos
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    // 🆕 Obtener datos con paginación
    const result = await remuneracionModel.getAll(filters, pagination);
    
    // 🆕 Obtener estadísticas (opcional, para mostrar totales)
    const stats = await remuneracionModel.getStats(filters);
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination, // 🆕 Información de paginación
      stats: stats, // 🆕 Estadísticas filtradas
      filters: filters // 🆕 Filtros aplicados (para debug)
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
      employee_name: req.body.nombre,
      employee_rut: req.body.rut,
      employee_position: req.body.cargo || 'No especificado',
      
      // TODO: Implementar funcionalidad de proyectos
      // Cuando se implemente, reemplazar con:
      // project_id: req.body.proyectoId ? parseInt(req.body.proyectoId) : null,
      project_id: null, // TEMPORAL: Siempre NULL hasta implementar proyectos
      
      // TEMPORAL: Por ahora usamos campos de texto para centro de costo
      project_name: req.body.centroCostoNombre || '',
      project_code: req.body.centroCosto || '',
      
      type: req.body.tipo,
      amount: req.body.montoTotal || (parseFloat(req.body.sueldoLiquido || 0) + parseFloat(req.body.anticipo || 0)),
      sueldo_liquido: req.body.sueldoLiquido || null,
      anticipo: req.body.anticipo || null,
      date: req.body.fecha,
      period: req.body.fecha.substring(0, 7),
      work_days: req.body.diasTrabajados || 30,
      payment_method: req.body.metodoPago || 'transfer',
      state: req.body.estado || 'pending',
      area: req.body.area || null
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
    
    // Array para almacenar IDs creados
    const createdIds = [];
    const errorItems = [];
    
    // Log para depuración
    console.log(`Procesando ${remuneracionesData.length} remuneraciones...`);
    console.log('Primer item:', JSON.stringify(remuneracionesData[0], null, 2));
    
    // Procesar cada remuneración
    for (const [index, item] of remuneracionesData.entries()) {
      try {
        // Convertir datos al formato del modelo
        const remuneracionData = {
          employee_id: item.employee_id || 0,
          employee_name: item.nombre,
          employee_rut: item.rut,
          employee_position: item.cargo || 'No especificado',
          
          // TODO: Implementar funcionalidad de proyectos
          // Cuando se implemente, reemplazar project_id: null con:
          // project_id: item.proyectoId ? parseInt(item.proyectoId) : null,
          project_id: null, // TEMPORAL: Siempre NULL hasta implementar proyectos
          
          // TEMPORAL: Guardar info de centro de costo en campos de texto
          project_name: item.centroCostoNombre || item.centroCosto || '',
          project_code: item.centroCosto || '',
          
          type: item.tipo,
          
          // Usar montoTotal o calcular correctamente
          amount: item.montoTotal || (parseFloat(item.sueldoLiquido || 0) + parseFloat(item.anticipo || 0)),
          
          sueldo_liquido: item.sueldoLiquido || null,
          anticipo: item.anticipo || null,
          date: item.fecha,
          period: item.fecha.substring(0, 7), // Formato YYYY-MM
          work_days: item.diasTrabajados || 30,
          payment_method: item.metodoPago || 'transfer',
          state: item.estado || 'pending',
          area: item.area || null
        };
        
        // Log para depuración de los primeros items
        if (index < 3) {
          console.log(`Item ${index} procesado:`, {
            nombre: remuneracionData.employee_name,
            amount: remuneracionData.amount,
            project_id: remuneracionData.project_id,
            project_code: remuneracionData.project_code
          });
        }
        
        // Crear remuneración
        const remuneracion = await remuneracionModel.create(remuneracionData);
        createdIds.push(remuneracion.id);
        
        // Log de progreso cada 50 items
        if ((index + 1) % 50 === 0) {
          console.log(`Procesados ${index + 1}/${remuneracionesData.length} items`);
        }
      } catch (error) {
        // Registrar error pero continuar con el resto
        errorItems.push({
          index,
          item: {
            nombre: item.nombre,
            rut: item.rut,
            error: error.message
          }
        });
        console.error(`Error al procesar item ${index} (${item.nombre}):`, error.message);
      }
    }
    
    // Devolver resultado
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
    
    const remuneracionData = {
      employee_name: req.body.nombre,
      employee_rut: req.body.rut,
      employee_position: req.body.cargo,
      
      // TODO: Implementar funcionalidad de proyectos
      project_id: null, // TEMPORAL: Siempre NULL
      project_name: req.body.centroCostoNombre || '',
      project_code: req.body.centroCosto || '',
      
      type: req.body.tipo,
      amount: req.body.montoTotal || (parseFloat(req.body.sueldoLiquido || 0) + parseFloat(req.body.anticipo || 0)),
      sueldo_liquido: req.body.sueldoLiquido || null,
      anticipo: req.body.anticipo || null,
      date: req.body.fecha,
      period: req.body.fecha.substring(0, 7),
      work_days: req.body.diasTrabajados || 30,
      payment_method: req.body.metodoPago || 'transfer',
      state: req.body.estado || 'pending',
      area: req.body.area || null
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
    
    // Validar que el estado sea válido
    const validStates = ['draft', 'pending', 'approved', 'paid', 'rejected', 'cancelled'];
    if (!validStates.includes(state)) {
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
      state: state,
      // Si se está marcando como pagado, establecer fecha de pago
      payment_date: state === 'paid' ? new Date().toISOString().split('T')[0] : currentRemuneracion.payment_date
    };
    
    const updated = await remuneracionModel.update(id, remuneracionData);
    
    res.json({
      success: true,
      message: `Estado de remuneración actualizado a ${state}`,
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