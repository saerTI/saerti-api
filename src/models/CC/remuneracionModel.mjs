import { pool } from '../../config/database.mjs';

/**
 * Normaliza una fecha para el formato DATE de MySQL (YYYY-MM-DD)
 */
function normalizeDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

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
 * Mapea tipos de remuneración a valores válidos para la base de datos
 */
function mapTypeToDatabase(type) {
  const typeMap = {
    'sueldo': 'remuneracion',
    'remuneracion': 'remuneracion',
    'anticipo': 'anticipo',
    'bono': 'remuneracion',
    'comision': 'remuneracion',
    'horas_extra': 'remuneracion',
    'REMUNERACION': 'remuneracion',
    'ANTICIPO': 'anticipo',
    'SUELDO': 'remuneracion'
  };
  
  return typeMap[type?.toLowerCase()] || 'remuneracion';
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
        CONCAT(p.month_period, '/', p.year_period) as period,
        e.full_name as employee_name,
        e.tax_id as employee_rut,
        e.position as employee_position,
        cc.id as cost_center_id,
        cc.name as cost_center_name,
        cc.code as cost_center_code
      FROM payroll p 
      LEFT JOIN employees e ON p.employee_id = e.id
      LEFT JOIN cost_centers cc ON e.default_cost_center_id = cc.id
      WHERE 1=1
    `;
    let queryParams = [];
    
    // Filtro de búsqueda por nombre de empleado
    if (filters.search && filters.search.trim()) {
      query += ' AND e.full_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    if (filters.state) {
      query += ' AND p.status = ?';
      queryParams.push(filters.state);
    }
    
    if (filters.employeeId) {
      query += ' AND p.employee_id = ?';
      queryParams.push(filters.employeeId);
    }
    
    // Filtro por período usando month_period y year_period
    if (filters.month) {
      query += ' AND p.month_period = ?';
      queryParams.push(filters.month);
    }
    
    if (filters.year) {
      query += ' AND p.year_period = ?';
      queryParams.push(filters.year);
    }
    
    // Soporte para el filtro period legacy (formato MM/YYYY)
    if (filters.period) {
      const [month, year] = filters.period.split('/');
      if (month && year) {
        query += ' AND p.month_period = ? AND p.year_period = ?';
        queryParams.push(parseInt(month), parseInt(year));
      }
    }
    
    if (filters.rut) {
      query += ' AND e.tax_id LIKE ?';
      queryParams.push(`%${filters.rut.replace(/[.-]/g, '')}%`);
    }
    
    if (filters.type) {
      const mappedType = mapTypeToDatabase(filters.type);
      query += ' AND p.type = ?';
      queryParams.push(mappedType);
    }
    
    // Query para contar el total
    const countQuery = query.replace(
      'SELECT p.*, CONCAT(p.month_period, \'/\', p.year_period) as period, e.full_name as employee_name, e.tax_id as employee_rut, e.position as employee_position, cc.id as cost_center_id, cc.name as cost_center_name, cc.code as cost_center_code', 
      'SELECT COUNT(*) as total'
    );
    
    // Agregar ordenamiento
    query += ' ORDER BY p.created_at DESC, e.full_name ASC';
    
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
 * Obtiene una remuneración por ID con información del empleado
 */
async function getById(id) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        CONCAT(p.month_period, '/', p.year_period) as period,
        e.full_name as employee_name,
        e.tax_id as employee_rut,
        e.position as employee_position,
        cc.id as cost_center_id,
        cc.name as cost_center_name,
        cc.code as cost_center_code
      FROM payroll p 
      LEFT JOIN employees e ON p.employee_id = e.id
      LEFT JOIN cost_centers cc ON e.default_cost_center_id = cc.id
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
    // Extraer month_period y year_period del período
    let monthPeriod, yearPeriod;
    
    if (remuneracionData.period) {
      const [month, year] = remuneracionData.period.split('/');
      monthPeriod = parseInt(month);
      yearPeriod = parseInt(year);
    } else {
      monthPeriod = remuneracionData.month_period || new Date().getMonth() + 1;
      yearPeriod = remuneracionData.year_period || new Date().getFullYear();
    }
    
    // Mapear tipo usando la nueva función
    const mappedType = mapTypeToDatabase(remuneracionData.type || 'sueldo');
    
    // Mapear estado: pending -> pendiente, etc.
    const mappedStatus = mapStatusToSpanish(remuneracionData.state || 'pending');
    
    // Normalizar fechas para formato DATE de MySQL
    const normalizedDate = normalizeDate(remuneracionData.date);
    const normalizedPaymentDate = normalizeDate(remuneracionData.payment_date);
    
    const [result] = await pool.query(
      `INSERT INTO payroll (
        employee_id, type, amount, net_salary, advance_payment, 
        date, month_period, year_period, work_days, payment_method, 
        status, payment_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        remuneracionData.employee_id,
        mappedType,
        remuneracionData.amount,
        remuneracionData.net_salary || remuneracionData.sueldo_liquido,
        remuneracionData.advance_payment || remuneracionData.anticipo,
        normalizedDate,
        monthPeriod,
        yearPeriod,
        remuneracionData.work_days || 30,
        mapPaymentMethodToSpanish(remuneracionData.payment_method || 'transferencia'),
        mappedStatus,
        normalizedPaymentDate,
        remuneracionData.notes
      ]
    );
    
    return { 
      id: result.insertId, 
      ...remuneracionData, 
      month_period: monthPeriod,
      year_period: yearPeriod 
    };
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
    // Extraer month_period y year_period del período
    let monthPeriod, yearPeriod;
    
    if (remuneracionData.period) {
      const [month, year] = remuneracionData.period.split('/');
      monthPeriod = parseInt(month);
      yearPeriod = parseInt(year);
    } else {
      monthPeriod = remuneracionData.month_period;
      yearPeriod = remuneracionData.year_period;
    }
    
    // Mapear tipo si es necesario
    const mappedType = remuneracionData.type === 'REMUNERACION' ? 'remuneracion' : 
                      remuneracionData.type === 'ANTICIPO' ? 'anticipo' : 
                      remuneracionData.type?.toLowerCase();
    
    // Validar que type no sea null (requerido por la base de datos)
    if (!mappedType) {
      throw new Error('Se requiere un tipo válido para actualizar la remuneración');
    }
    
    // Mapear estado si es necesario
    const mappedStatus = mapStatusToSpanish(remuneracionData.state || 'pending');
    
    // Normalizar fechas para formato DATE de MySQL
    const normalizedDate = normalizeDate(remuneracionData.date);
    const normalizedPaymentDate = normalizeDate(remuneracionData.payment_date);
    
    const [result] = await pool.query(
      `UPDATE payroll SET 
        employee_id = ?, type = ?, amount = ?, net_salary = ?, 
        advance_payment = ?, date = ?, month_period = ?, year_period = ?, 
        work_days = ?, payment_method = ?, status = ?, payment_date = ?, 
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        remuneracionData.employee_id,
        mappedType,
        remuneracionData.amount,
        remuneracionData.net_salary || remuneracionData.sueldo_liquido,
        remuneracionData.advance_payment || remuneracionData.anticipo,
        normalizedDate,
        monthPeriod,
        yearPeriod,
        remuneracionData.work_days,
        mapPaymentMethodToSpanish(remuneracionData.payment_method || 'transferencia'),
        mappedStatus,
        normalizedPaymentDate,
        remuneracionData.notes,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { 
      id, 
      ...remuneracionData, 
      month_period: monthPeriod,
      year_period: yearPeriod 
    };
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
      FROM payroll p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Aplicar mismos filtros que en getAll (excepto paginación)
    if (filters.search && filters.search.trim()) {
      query += ' AND e.full_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    if (filters.state) {
      query += ' AND p.status = ?';
      queryParams.push(filters.state);
    }
    
    if (filters.month) {
      query += ' AND p.month_period = ?';
      queryParams.push(filters.month);
    }
    
    if (filters.year) {
      query += ' AND p.year_period = ?';
      queryParams.push(filters.year);
    }
    
    // Soporte para filtro period legacy
    if (filters.period) {
      const [month, year] = filters.period.split('/');
      if (month && year) {
        query += ' AND p.month_period = ? AND p.year_period = ?';
        queryParams.push(parseInt(month), parseInt(year));
      }
    }
    
    const [rows] = await pool.query(query, queryParams);
    return rows[0];
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
}

/**
 * Busca un empleado por RUT
 * @param {string} rut - RUT del empleado
 * @returns {Promise<Object|null>} Datos del empleado o null si no existe
 */
async function findEmployeeByRut(rut) {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, tax_id FROM employees WHERE tax_id = ?',
      [rut]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error en findEmployeeByRut:', error.message);
    throw error;
  }
}

/**
 * Busca un centro de costo por nombre
 * @param {string} name - Nombre del centro de costo
 * @returns {Promise<Object|null>} Datos del centro de costo o null si no existe
 */
async function findCostCenterByName(name) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name FROM cost_centers WHERE name = ? OR UPPER(name) = UPPER(?)',
      [name, name]
    );
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error en findCostCenterByName:', error.message);
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
  findEmployeeByRut,
  findCostCenterByName,
  mapTypeToDatabase
};