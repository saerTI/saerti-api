import { pool } from '../../config/database.mjs';

/**
 * Mapea estados de inglés a español para la base de datos
 */
function mapStatusToSpanish(status) {
  const statusMap = {
    'draft': 'pendiente',
    'pending': 'pendiente', 
    'approved': 'aprobado',
    'paid': 'pagado',
    'rejected': 'rechazado',
    'cancelled': 'cancelado'
  };
  
  // Si ya está en español, devolverlo tal como está
  const spanishValues = ['pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado'];
  if (spanishValues.includes(status)) {
    return status;
  }
  
  // Mapear de inglés a español
  return statusMap[status] || 'pendiente';
}

/**
 * Mapea métodos de pago a español para la base de datos
 */
function mapPaymentMethodToSpanish(method) {
  const methodMap = {
    'transfer': 'transferencia',
    'transferencia': 'transferencia',
    'check': 'cheque',
    'cheque': 'cheque', 
    'cash': 'efectivo',
    'efectivo': 'efectivo'
  };
  
  return methodMap[method?.toLowerCase()] || 'transferencia';
}

/**
 * Función auxiliar para obtener el ID del centro de costo por código
 */
async function getCostCenterIdByCode(code) {
  try {
    if (!code || code.trim() === '') {
      return null;
    }
    
    const [rows] = await pool.query(
      'SELECT id FROM cost_centers WHERE code = ? LIMIT 1',
      [code.trim()]
    );
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error(`Error al buscar centro de costo con código ${code}:`, error);
    return null;
  }
}

/**
 * Obtiene todas las remuneraciones con filtros, búsqueda y paginación
 */
async function getAll(filters = {}, pagination = {}) {
  try {
    // 🔥 CAMBIO CRÍTICO: Si limit es null, no aplicar límite
    const limit = pagination.limit; // null o número
    const offset = parseInt(pagination.offset) || 0;
    
    let query = `
      SELECT 
        p.*,
        p.employee_tax_id as employee_rut,
        p.net_salary as sueldo_liquido,
        p.advance_payment as anticipo,
        cc.code as center_code, 
        cc.name as center_name,
        cc.code as project_code,
        cc.name as project_name
      FROM payroll p 
      LEFT JOIN cost_centers cc ON p.cost_center_id = cc.id 
      WHERE 1=1
    `;
    let queryParams = [];
    
    // ... (mantener todos los filtros igual) ...
    
    // Filtro de búsqueda por nombre
    if (filters.search && filters.search.trim()) {
      query += ' AND p.employee_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    if (filters.state) {
      query += ' AND p.status = ?';
      queryParams.push(filters.state);
    }
    
    if (filters.projectId || filters.costCenterId || filters.centroCostoId) {
      query += ' AND p.cost_center_id = ?';
      queryParams.push(filters.projectId || filters.costCenterId || filters.centroCostoId);
    }
    
    if (filters.period) {
      query += ' AND p.period = ?';
      queryParams.push(filters.period);
    }
    
    if (filters.area) {
      query += ' AND p.area LIKE ?';
      queryParams.push(`%${filters.area}%`);
    }
    
    if (filters.rut) {
      query += ' AND p.employee_tax_id LIKE ?';
      queryParams.push(`%${filters.rut.replace(/[.-]/g, '')}%`);
    }
    
    if (filters.type) {
      const mappedType = filters.type === 'REMUNERACION' ? 'remuneracion' : 
                        filters.type === 'ANTICIPO' ? 'anticipo' : 
                        filters.type?.toLowerCase();
      query += ' AND p.type = ?';
      queryParams.push(mappedType);
    }
    
    // Query para contar el total
    const countQuery = query.replace(
      'SELECT p.*, p.employee_tax_id as employee_rut, p.net_salary as sueldo_liquido, p.advance_payment as anticipo, cc.code as center_code, cc.name as center_name, cc.code as project_code, cc.name as project_name', 
      'SELECT COUNT(*) as total'
    );
    
    // Agregar ordenamiento
    query += ' ORDER BY p.created_at DESC, p.employee_name ASC';
    
    // 🔥 SOLO AGREGAR LIMIT/OFFSET SI SE ESPECIFICA LIMIT
    const finalQueryParams = [...queryParams];
    if (limit !== null) {
      query += ' LIMIT ? OFFSET ?';
      finalQueryParams.push(limit, offset);
      
      // Calcular página para paginación
      const page = Math.floor(offset / limit) + 1;
      const [countResult] = await pool.query(countQuery, queryParams);
      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);
      
      const [rows] = await pool.query(query, finalQueryParams);
      
      return {
        data: rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total: total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      };
    } else {
      // 🔥 SIN LÍMITE: Obtener TODOS los registros
      const [rows] = await pool.query(query, finalQueryParams);
      const total = rows.length;
      
      return {
        data: rows,
        pagination: {
          current_page: 1,
          per_page: total,
          total: total,
          total_pages: 1,
          has_next: false,
          has_prev: false
        }
      };
    }
  } catch (error) {
    console.error('Error al obtener remuneraciones:', error);
    throw error;
  }
}

/**
 * Obtiene una remuneración por ID con información del centro de costo
 */
async function getById(id) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        p.employee_tax_id as employee_rut,
        p.net_salary as sueldo_liquido,
        p.advance_payment as anticipo,
        cc.code as center_code, 
        cc.name as center_name,
        cc.code as project_code,
        cc.name as project_name
      FROM payroll p 
      LEFT JOIN cost_centers cc ON p.cost_center_id = cc.id 
      WHERE p.id = ?
    `, [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error al obtener remuneración por ID:', error);
    throw error;
  }
}

/**
 * Crea una nueva remuneración
 */
async function create(remuneracionData) {
  try {
    // Mapear código de centro de costo a ID si se proporciona
    let costCenterId = remuneracionData.cost_center_id;
    
    // Si no se proporciona ID pero sí código, buscar el ID
    if (!costCenterId && remuneracionData.centro_costo_code) {
      costCenterId = await getCostCenterIdByCode(remuneracionData.centro_costo_code);
      if (!costCenterId) {
        console.warn(`⚠️ Centro de costo no encontrado para código: ${remuneracionData.centro_costo_code}`);
        // Usar un centro de costo por defecto (ej: Oficina Central)
        costCenterId = await getCostCenterIdByCode('001-0');
      }
    }
    
    // Mapear tipo: REMUNERACION -> remuneracion, ANTICIPO -> anticipo
    const mappedType = remuneracionData.type === 'REMUNERACION' ? 'remuneracion' : 
                      remuneracionData.type === 'ANTICIPO' ? 'anticipo' : 
                      remuneracionData.type?.toLowerCase();
    
    // Mapear estado: pending -> pendiente, etc.
    const mappedStatus = mapStatusToSpanish(remuneracionData.state || 'pending');
    
    const [result] = await pool.query(
      `INSERT INTO payroll (
        employee_id, employee_name, employee_tax_id, employee_position,
        cost_center_id, type, amount, net_salary, advance_payment, 
        date, period, work_days, payment_method, status, area, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        remuneracionData.employee_id || 0,
        remuneracionData.employee_name,
        remuneracionData.employee_rut, // employee_tax_id
        remuneracionData.employee_position,
        costCenterId,
        mappedType,
        remuneracionData.amount,
        remuneracionData.sueldo_liquido, // net_salary
        remuneracionData.anticipo, // advance_payment
        remuneracionData.date,
        remuneracionData.period,
        remuneracionData.work_days || 30,
        mapPaymentMethodToSpanish(remuneracionData.payment_method || 'transferencia'),
        mappedStatus, // status
        remuneracionData.area,
        remuneracionData.notes
      ]
    );
    
    return { id: result.insertId, ...remuneracionData, cost_center_id: costCenterId };
  } catch (error) {
    console.error('Error al crear remuneración:', error);
    throw error;
  }
}

/**
 * Actualiza una remuneración existente
 */
async function update(id, remuneracionData) {
  try {
    // Mapear código de centro de costo a ID si se proporciona
    let costCenterId = remuneracionData.cost_center_id;
    
    if (!costCenterId && remuneracionData.centro_costo_code) {
      costCenterId = await getCostCenterIdByCode(remuneracionData.centro_costo_code);
    }
    
    // Mapear tipo si es necesario
    const mappedType = remuneracionData.type === 'REMUNERACION' ? 'remuneracion' : 
                      remuneracionData.type === 'ANTICIPO' ? 'anticipo' : 
                      remuneracionData.type?.toLowerCase();
    
    // Mapear estado si es necesario
    const mappedStatus = mapStatusToSpanish(remuneracionData.state || 'pending');
    
    const [result] = await pool.query(
      `UPDATE payroll SET 
        employee_name = ?, employee_tax_id = ?, employee_position = ?,
        cost_center_id = ?, type = ?, amount = ?, net_salary = ?, 
        advance_payment = ?, date = ?, period = ?, work_days = ?, 
        payment_method = ?, status = ?, area = ?, payment_date = ?, 
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        remuneracionData.employee_name,
        remuneracionData.employee_rut, // employee_tax_id
        remuneracionData.employee_position,
        costCenterId,
        mappedType,
        remuneracionData.amount,
        remuneracionData.sueldo_liquido, // net_salary
        remuneracionData.anticipo, // advance_payment
        remuneracionData.date,
        remuneracionData.period,
        remuneracionData.work_days,
        mapPaymentMethodToSpanish(remuneracionData.payment_method || 'transferencia'),
        mappedStatus, // status
        remuneracionData.area,
        remuneracionData.payment_date,
        remuneracionData.notes,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id, ...remuneracionData, cost_center_id: costCenterId };
  } catch (error) {
    console.error('Error al actualizar remuneración:', error);
    throw error;
  }
}

/**
 * Elimina una remuneración
 */
async function deleteRemuneracion(id) {
  try {
    const [result] = await pool.query(
      'DELETE FROM payroll WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error al eliminar remuneración:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas rápidas
 */
async function getStats(filters = {}) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'pagado' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN type = 'remuneracion' THEN amount ELSE 0 END) as total_remuneraciones,
        SUM(CASE WHEN type = 'anticipo' THEN amount ELSE 0 END) as total_anticipos
      FROM payroll 
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Aplicar mismos filtros que en getAll (excepto paginación)
    if (filters.search && filters.search.trim()) {
      query += ' AND employee_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    if (filters.state) {
      query += ' AND status = ?';
      queryParams.push(filters.state);
    }
    
    if (filters.period) {
      query += ' AND period = ?';
      queryParams.push(filters.period);
    }
    
    const [rows] = await pool.query(query, queryParams);
    return rows[0];
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
}

export {
  getAll,
  getById,
  create,
  update,
  deleteRemuneracion as delete,
  getStats,
  getCostCenterIdByCode
};