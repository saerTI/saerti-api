import { pool } from '../../config/database.mjs';

/**
 * Obtiene todas las remuneraciones con filtros, búsqueda y paginación
 */
async function getAll(filters = {}, pagination = {}) {
  try {
    // Parámetros de paginación con valores por defecto
    const limit = parseInt(pagination.limit) || 50;
    const offset = parseInt(pagination.offset) || 0;
    const page = Math.floor(offset / limit) + 1;
    
    // Construir query con filtros dinámicos
    let query = 'SELECT * FROM remuneraciones WHERE 1=1';
    let queryParams = [];
    
    // Filtro de búsqueda por nombre (insensible a mayúsculas)
    if (filters.search && filters.search.trim()) {
      query += ' AND employee_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    // Filtro por estado
    if (filters.state) {
      query += ' AND state = ?';
      queryParams.push(filters.state);
    }
    
    // Filtro por proyecto
    if (filters.projectId) {
      query += ' AND project_id = ?';
      queryParams.push(filters.projectId);
    }
    
    // Filtro por período (formato YYYY-MM)
    if (filters.period) {
      query += ' AND period = ?';
      queryParams.push(filters.period);
    }
    
    // Filtro por área
    if (filters.area) {
      query += ' AND area LIKE ?';
      queryParams.push(`%${filters.area}%`);
    }
    
    // Filtro por RUT
    if (filters.rut) {
      query += ' AND employee_rut LIKE ?';
      queryParams.push(`%${filters.rut.replace(/[.-]/g, '')}%`);
    }
    
    // Filtro por tipo
    if (filters.type) {
      query += ' AND type = ?';
      queryParams.push(filters.type);
    }
    
    // Query para contar el total (sin limit/offset)
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    
    // Agregar ordenamiento y paginación
    query += ' ORDER BY created_at DESC, employee_name ASC';
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
    
    // Ejecutar ambas queries
    const [rows] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2)); // Remover limit y offset del conteo
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
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
  } catch (error) {
    console.error('Error al obtener remuneraciones:', error);
    throw error;
  }
}

/**
 * Obtiene una remuneración por ID
 */
async function getById(id) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM remuneraciones WHERE id = ?',
      [id]
    );
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
    const [result] = await pool.query(
      `INSERT INTO remuneraciones (
        employee_id, employee_name, employee_rut, employee_position,
        project_id, project_name, project_code, type, amount,
        sueldo_liquido, anticipo, date, period, work_days,
        payment_method, state, area, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        remuneracionData.employee_id,
        remuneracionData.employee_name,
        remuneracionData.employee_rut,
        remuneracionData.employee_position,
        remuneracionData.project_id,
        remuneracionData.project_name,
        remuneracionData.project_code,
        remuneracionData.type,
        remuneracionData.amount,
        remuneracionData.sueldo_liquido,
        remuneracionData.anticipo,
        remuneracionData.date,
        remuneracionData.period,
        remuneracionData.work_days,
        remuneracionData.payment_method,
        remuneracionData.state,
        remuneracionData.area,
        remuneracionData.notes
      ]
    );
    
    return { id: result.insertId, ...remuneracionData };
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
    const [result] = await pool.query(
      `UPDATE remuneraciones SET 
        employee_name = ?, employee_rut = ?, employee_position = ?,
        project_id = ?, project_name = ?, project_code = ?, type = ?,
        amount = ?, sueldo_liquido = ?, anticipo = ?, date = ?,
        period = ?, work_days = ?, payment_method = ?, state = ?,
        area = ?, payment_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        remuneracionData.employee_name,
        remuneracionData.employee_rut,
        remuneracionData.employee_position,
        remuneracionData.project_id,
        remuneracionData.project_name,
        remuneracionData.project_code,
        remuneracionData.type,
        remuneracionData.amount,
        remuneracionData.sueldo_liquido,
        remuneracionData.anticipo,
        remuneracionData.date,
        remuneracionData.period,
        remuneracionData.work_days,
        remuneracionData.payment_method,
        remuneracionData.state,
        remuneracionData.area,
        remuneracionData.payment_date,
        remuneracionData.notes,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { id, ...remuneracionData };
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
      'DELETE FROM remuneraciones WHERE id = ?',
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
        SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN state = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN type = 'REMUNERACION' THEN amount ELSE 0 END) as total_remuneraciones,
        SUM(CASE WHEN type = 'ANTICIPO' THEN amount ELSE 0 END) as total_anticipos
      FROM remuneraciones 
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Aplicar mismos filtros que en getAll (excepto paginación)
    if (filters.search && filters.search.trim()) {
      query += ' AND employee_name LIKE ?';
      queryParams.push(`%${filters.search.trim()}%`);
    }
    
    if (filters.state) {
      query += ' AND state = ?';
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
  getStats
};