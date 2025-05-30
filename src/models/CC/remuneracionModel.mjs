import { pool } from '../../config/database.mjs';

/**
 * Modelo para gestionar remuneraciones
 */
export default {
  /**
   * Crea un nuevo registro de remuneración
   * @param {Object} remuneracionData - Datos de la remuneración
   * @returns {Promise<Object>} Registro creado
   */
  async create(remuneracionData) {
    try {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Obtener datos del proyecto si se proporciona
        let projectName = null;
        let projectCode = null;
        
        if (remuneracionData.project_id) {
          const [projectRows] = await connection.query(
            'SELECT name, code FROM construction_projects WHERE id = ?',
            [remuneracionData.project_id]
          );
          
          if (projectRows.length > 0) {
            projectName = projectRows[0].name;
            projectCode = projectRows[0].code;
          }
        }
        
        // Calcular monto total basado en el tipo
        let amount = 0;
        if (remuneracionData.type === 'REMUNERACION') {
          amount = remuneracionData.sueldo_liquido || 0;
        } else if (remuneracionData.type === 'ANTICIPO') {
          amount = remuneracionData.anticipo || 0;
        }
        
        // Insertar remuneración
        const [result] = await connection.query(
          `INSERT INTO remuneraciones 
           (employee_id, employee_name, employee_rut, employee_position, project_id, 
            project_name, project_code, type, amount, sueldo_liquido, anticipo, 
            date, period, work_days, payment_method, state, area, payment_date, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            remuneracionData.employee_id,
            remuneracionData.employee_name,
            remuneracionData.employee_rut,
            remuneracionData.employee_position || null,
            remuneracionData.project_id || null,
            projectName,
            projectCode,
            remuneracionData.type,
            amount,
            remuneracionData.sueldo_liquido || null,
            remuneracionData.anticipo || null,
            remuneracionData.date,
            remuneracionData.period,
            remuneracionData.work_days || 30,
            remuneracionData.payment_method || 'transfer',
            remuneracionData.state || 'pending',
            remuneracionData.area || null,
            remuneracionData.payment_date || null,
            remuneracionData.notes || null
          ]
        );
        
        const remuneracionId = result.insertId;
        
        // Obtener el registro creado
        const [remuneraciones] = await connection.query(
          'SELECT * FROM remuneraciones WHERE id = ?',
          [remuneracionId]
        );
        
        await connection.commit();
        return remuneraciones[0];
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error en create remuneración:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene una remuneración por su ID
   * @param {number} id - ID de la remuneración
   * @returns {Promise<Object|null>} Datos de la remuneración o null si no existe
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM remuneraciones WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      console.error('Error en getById remuneración:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza una remuneración existente
   * @param {number} id - ID de la remuneración a actualizar
   * @param {Object} remuneracionData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async update(id, remuneracionData) {
    try {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Actualizar datos del proyecto si se proporciona
        let projectName = null;
        let projectCode = null;
        
        if (remuneracionData.project_id) {
          const [projectRows] = await connection.query(
            'SELECT name, code FROM construction_projects WHERE id = ?',
            [remuneracionData.project_id]
          );
          
          if (projectRows.length > 0) {
            projectName = projectRows[0].name;
            projectCode = projectRows[0].code;
            
            // Actualizar project_name y project_code
            remuneracionData.project_name = projectName;
            remuneracionData.project_code = projectCode;
          }
        }
        
        // Actualizar monto total si cambia el tipo o valores monetarios
        if ((remuneracionData.type && remuneracionData.type === 'REMUNERACION' && remuneracionData.sueldo_liquido) ||
            (remuneracionData.type && remuneracionData.type === 'ANTICIPO' && remuneracionData.anticipo)) {
          
          let amount = 0;
          if (remuneracionData.type === 'REMUNERACION') {
            amount = remuneracionData.sueldo_liquido;
          } else if (remuneracionData.type === 'ANTICIPO') {
            amount = remuneracionData.anticipo;
          }
          
          remuneracionData.amount = amount;
        } else if (!remuneracionData.type) {
          // Si no se especifica un nuevo tipo, necesitamos obtener el tipo actual
          const [currentData] = await connection.query(
            'SELECT type FROM remuneraciones WHERE id = ?',
            [id]
          );
          
          if (currentData.length > 0) {
            const currentType = currentData[0].type;
            
            // Actualizar monto según el tipo actual
            if (currentType === 'REMUNERACION' && remuneracionData.sueldo_liquido) {
              remuneracionData.amount = remuneracionData.sueldo_liquido;
            } else if (currentType === 'ANTICIPO' && remuneracionData.anticipo) {
              remuneracionData.amount = remuneracionData.anticipo;
            }
          }
        }
        
        const fields = [];
        const values = [];
        
        // Construir consulta dinámica con solo los campos a actualizar
        const updateableFields = [
          'employee_id', 'employee_name', 'employee_rut', 'employee_position', 'project_id',
          'project_name', 'project_code', 'type', 'amount', 'sueldo_liquido', 'anticipo',
          'date', 'period', 'work_days', 'payment_method', 'state', 'area', 'payment_date', 'notes'
        ];
        
        updateableFields.forEach(field => {
          if (remuneracionData[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(remuneracionData[field]);
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
          `UPDATE remuneraciones SET ${fields.join(', ')} WHERE id = ?`,
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
      console.error('Error en update remuneración:', error.message);
      throw error;
    }
  },

  /**
   * Elimina una remuneración
   * @param {number} id - ID de la remuneración a eliminar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM remuneraciones WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete remuneración:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza el estado de una remuneración
   * @param {number} id - ID de la remuneración
   * @param {string} state - Nuevo estado
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateState(id, state) {
    try {
      const [result] = await pool.query(
        'UPDATE remuneraciones SET state = ? WHERE id = ?',
        [state, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateState remuneración:', error.message);
      throw error;
    }
  },

  /**
   * Lista las remuneraciones con filtros y paginación
   * @param {Object} filters - Filtros a aplicar
   * @param {number} page - Número de página
   * @param {number} limit - Límite de resultados por página
   * @returns {Promise<Object>} Lista de remuneraciones y metadatos de paginación
   */
  async list(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const whereConditions = [];
      const queryParams = [];
      
      // Aplicar filtros
      if (filters.state) {
        whereConditions.push('state = ?');
        queryParams.push(filters.state);
      }
      
      if (filters.employee_position) {
        whereConditions.push('employee_position = ?');
        queryParams.push(filters.employee_position);
      }
      
      if (filters.project_id) {
        whereConditions.push('project_id = ?');
        queryParams.push(filters.project_id);
      }
      
      if (filters.period && Array.isArray(filters.period) && filters.period.length > 0) {
        whereConditions.push('period IN (?)');
        queryParams.push(filters.period);
      }
      
      if (filters.date_from) {
        whereConditions.push('date >= ?');
        queryParams.push(filters.date_from);
      }
      
      if (filters.date_to) {
        whereConditions.push('date <= ?');
        queryParams.push(filters.date_to);
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
      
      // Obtener remuneraciones
      const [rows] = await pool.query(
        `SELECT * FROM remuneraciones 
         ${whereClause} 
         ORDER BY date DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );
      
      // Obtener total para la paginación
      const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM remuneraciones ${whereClause}`,
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
      console.error('Error en list remuneraciones:', error.message);
      throw error;
    }
  }
};