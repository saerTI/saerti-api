import { pool } from "../../config/database.mjs";

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
 * Modelo para gestionar previsionales (AFP, Isapre, etc.)
 */
export default {
  /**
   * Crea un nuevo registro previsional
   * @param {Object} previsionalData - Datos del previsional
   * @returns {Promise<Object>} Registro creado
   */
  async create(previsionalData) {
    try {
      const connection = await pool.getConnection();
      try {
        // Normalizar fechas para formato DATE de MySQL
        const normalizedDate = normalizeDate(previsionalData.date);
        const normalizedPaymentDate = normalizeDate(previsionalData.payment_date);
        
        const [result] = await connection.query(
          `INSERT INTO previsionales 
           (employee_id, cost_center_id, type, amount, date, month_period, year_period, status, payment_date, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            previsionalData.employee_id,
            previsionalData.cost_center_id,
            previsionalData.type,
            previsionalData.amount,
            normalizedDate,
            previsionalData.month_period,
            previsionalData.year_period,
            previsionalData.status || 'pendiente',
            normalizedPaymentDate,
            previsionalData.notes || null
          ]
        );
        
        const previsionalId = result.insertId;
        
        const [previsionales] = await connection.query(
          'SELECT * FROM previsionales WHERE id = ?',
          [previsionalId]
        );
        
        return previsionales[0];
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error en create previsional:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene un previsional por su ID
   * @param {number} id - ID del previsional
   * @returns {Promise<Object|null>} Datos del previsional o null si no existe
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM previsionales WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      console.error('Error en getById previsional:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza un previsional existente
   * @param {number} id - ID del previsional a actualizar
   * @param {Object} previsionalData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async update(id, previsionalData) {
    try {
      const connection = await pool.getConnection();
      try {
        const fields = [];
        const values = [];
        
        const updateableFields = [
          'employee_id', 'cost_center_id', 'type', 'amount', 'month_period', 
          'year_period', 'status', 'notes'
        ];
        
        // Handle regular fields
        updateableFields.forEach(field => {
          if (previsionalData[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(previsionalData[field]);
          }
        });
        
        // Handle date fields with normalization
        if (previsionalData.date !== undefined) {
          fields.push('date = ?');
          values.push(normalizeDate(previsionalData.date));
        }
        
        if (previsionalData.payment_date !== undefined) {
          fields.push('payment_date = ?');
          values.push(normalizeDate(previsionalData.payment_date));
        }
        
        if (fields.length === 0) {
          return false;
        }
        
        values.push(id);
        
        const [result] = await connection.query(
          `UPDATE previsionales SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        
        return result.affectedRows > 0;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error en update previsional:', error.message);
      throw error;
    }
  },

  /**
   * Elimina un previsional
   * @param {number} id - ID del previsional a eliminar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM previsionales WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete previsional:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza el estado de un previsional
   * @param {number} id - ID del previsional
   * @param {string} status - Nuevo estado
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateStatus(id, status) {
    try {
      const [result] = await pool.query(
        'UPDATE previsionales SET status = ? WHERE id = ?',
        [status, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateStatus previsional:', error.message);
      throw error;
    }
  },

  /**
   * Lista los previsionales con filtros y paginación
   * @param {Object} filters - Filtros a aplicar
   * @param {number} page - Número de página
   * @param {number} limit - Límite de resultados por página
   * @returns {Promise<Object>} Lista de previsionales y metadatos de paginación
   */
  async list(filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const whereConditions = [];
      const queryParams = [];
      
      if (filters.status) {
        whereConditions.push('status = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.type) {
        whereConditions.push('type = ?');
        queryParams.push(filters.type);
      }

      if (filters.cost_center_id) {
        whereConditions.push('cost_center_id = ?');
        queryParams.push(filters.cost_center_id);
      }
      
      if (filters.month_period) {
        whereConditions.push('month_period = ?');
        queryParams.push(filters.month_period);
      }

      if (filters.year_period) {
        whereConditions.push('year_period = ?');
        queryParams.push(filters.year_period);
      }
      
      if (filters.start_date) {
        whereConditions.push('date >= ?');
        queryParams.push(filters.start_date);
      }
      
      if (filters.end_date) {
        whereConditions.push('date <= ?');
        queryParams.push(filters.end_date);
      }
      
      // ... otros filtros que quieras mantener
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      const [rows] = await pool.query(
        `SELECT p.*, e.full_name as employee_name, e.tax_id as employee_rut, cc.name as cost_center_name
         FROM previsionales p
         LEFT JOIN employees e ON p.employee_id = e.id
         LEFT JOIN cost_centers cc ON p.cost_center_id = cc.id
         ${whereClause} 
         ORDER BY p.date DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );
      
      const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM previsionales ${whereClause}`,
        queryParams
      );
      
      const total = countResult[0].total;
      
      return {
        data: rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error en list previsionales:', error.message);
      throw error;
    }
  },

  /**
   * Busca un empleado por RUT
   * @param {string} rut - RUT del empleado
   * @returns {Promise<Object|null>} Datos del empleado o null si no existe
   */
  async findEmployeeByRut(rut) {
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
  },

  /**
   * Busca un centro de costo por nombre
   * @param {string} name - Nombre del centro de costo
   * @returns {Promise<Object|null>} Datos del centro de costo o null si no existe
   */
  async findCostCenterByName(name) {
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
};