import { pool } from "../../config/database.mjs";

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
        await connection.beginTransaction();
        
        // Obtener datos del proyecto si se proporciona
        let projectName = null;
        let projectCode = null;
        
        if (previsionalData.cost_center_id) {
          const [projectRows] = await connection.query(
            'SELECT name, code FROM cost_centers WHERE id = ?',
            [previsionalData.cost_center_id]
          );
          
          if (projectRows.length > 0) {
            projectName = projectRows[0].name;
            projectCode = projectRows[0].code;
          }
        }
        
        // Insertar previsional
        const [result] = await connection.query(
          `INSERT INTO previsionales 
           (employee_id, employee_name, employee_rut, cost_center_id, project_name, project_code, 
            type, amount, date, period, state, area, centro_costo, centro_costo_nombre, 
            descuentos_legales, payment_date, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            previsionalData.employee_id,
            previsionalData.employee_name,
            previsionalData.employee_rut,
            previsionalData.cost_center_id || null,
            projectName,
            projectCode,
            previsionalData.type,
            previsionalData.amount,
            previsionalData.date,
            previsionalData.period,
            previsionalData.state || 'pending',
            previsionalData.area || null,
            previsionalData.centro_costo || null,
            previsionalData.centro_costo_nombre || null,
            previsionalData.descuentos_legales || null,
            previsionalData.payment_date || null,
            previsionalData.notes || null
          ]
        );
        
        const previsionalId = result.insertId;
        
        // Obtener el registro creado
        const [previsionales] = await connection.query(
          'SELECT * FROM previsionales WHERE id = ?',
          [previsionalId]
        );
        
        await connection.commit();
        return previsionales[0];
      } catch (error) {
        await connection.rollback();
        throw error;
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
        await connection.beginTransaction();
        
        // Actualizar datos del proyecto si se proporciona
        let projectName = null;
        let projectCode = null;
        
        if (previsionalData.cost_center_id) {
          const [projectRows] = await connection.query(
            'SELECT name, code FROM cost_centers WHERE id = ?',
            [previsionalData.cost_center_id]
          );
          
          if (projectRows.length > 0) {
            projectName = projectRows[0].name;
            projectCode = projectRows[0].code;
            
            // Actualizar project_name y project_code
            previsionalData.project_name = projectName;
            previsionalData.project_code = projectCode;
          }
        }
        
        const fields = [];
        const values = [];
        
        // Construir consulta dinámica con solo los campos a actualizar
        const updateableFields = [
          'employee_id', 'employee_name', 'employee_rut', 'cost_center_id', 'project_name',
          'project_code', 'type', 'amount', 'date', 'period', 'state', 'area', 
          'centro_costo', 'centro_costo_nombre', 'descuentos_legales', 'payment_date', 'notes'
        ];
        
        updateableFields.forEach(field => {
          if (previsionalData[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(previsionalData[field]);
          }
        });
        
        // Si no hay campos para actualizar, retornar
        if (fields.length === 0) {
          return false;
        }
        
        // Añadir ID al final de los parámetros
        values.push(id);
        
        // Ejecutar actualización
        const [result] = await connection.query(
          `UPDATE previsionales SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        
        await connection.commit();
        return result.affectedRows > 0;
      } catch (error) {
        await connection.rollback();
        throw error;
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
   * @param {string} state - Nuevo estado
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateState(id, state) {
    try {
      const [result] = await pool.query(
        'UPDATE previsionales SET state = ? WHERE id = ?',
        [state, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateState previsional:', error.message);
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
      
      // Aplicar filtros
      if (filters.state) {
        whereConditions.push('state = ?');
        queryParams.push(filters.state);
      }
      
      if (filters.category) {
        whereConditions.push('type = ?');
        queryParams.push(filters.category);
      }
      
      if (filters.cost_center_id) {
        whereConditions.push('cost_center_id = ?');
        queryParams.push(filters.cost_center_id);
      }
      
      if (filters.period && Array.isArray(filters.period) && filters.period.length > 0) {
        whereConditions.push('period IN (?)');
        queryParams.push(filters.period);
      }
      
      if (filters.area) {
        whereConditions.push('area = ?');
        queryParams.push(filters.area);
      }
      
      if (filters.centro_costo) {
        whereConditions.push('centro_costo = ?');
        queryParams.push(filters.centro_costo);
      }
      
      if (filters.start_date) {
        whereConditions.push('date >= ?');
        queryParams.push(filters.start_date);
      }
      
      if (filters.end_date) {
        whereConditions.push('date <= ?');
        queryParams.push(filters.end_date);
      }
      
      if (filters.min_amount) {
        whereConditions.push('amount >= ?');
        queryParams.push(filters.min_amount);
      }
      
      if (filters.max_amount) {
        whereConditions.push('amount <= ?');
        queryParams.push(filters.max_amount);
      }
      
      if (filters.search) {
        whereConditions.push('(employee_name LIKE ? OR employee_rut LIKE ? OR project_name LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }
      
      // Construir la cláusula WHERE
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Obtener previsionales
      const [rows] = await pool.query(
        `SELECT * FROM previsionales 
         ${whereClause} 
         ORDER BY date DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );
      
      // Obtener total para la paginación
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
  }
};