import { pool } from '../config/database.mjs';

/**
 * Modelo de Proyectos para gestionar las operaciones relacionadas con proyectos de construcción
 */
export default {
  /**
   * Crea un nuevo proyecto de construcción
   * @param {Object} projectData - Datos del proyecto
   * @returns {Promise<Object>} Proyecto creado
   */
  async create(projectData) {
    try {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Insertar proyecto
        const [result] = await connection.query(
          `INSERT INTO construction_projects 
           (owner_id, name, code, client_id, status, start_date, expected_end_date, total_budget, description, location, location_lat, location_lon) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectData.owner_id,
            projectData.name,
            projectData.code,
            projectData.client_id || null,
            projectData.status || 'draft',
            projectData.start_date || null,
            projectData.expected_end_date || null,
            projectData.total_budget || null,
            projectData.description || null,
            projectData.location || null,
            projectData.location_lat || null,
            projectData.location_lon || null
          ]
        );
        
        const projectId = result.insertId;
        
        // Obtener el proyecto creado
        const [projects] = await connection.query(
          'SELECT * FROM construction_projects WHERE id = ?',
          [projectId]
        );
        
        await connection.commit();
        return projects[0];
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene un proyecto por su ID
   * @param {number} id - ID del proyecto
   * @returns {Promise<Object|null>} Datos del proyecto o null si no existe
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM construction_projects WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      console.error('Error en getById:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza un proyecto existente
   * @param {number} id - ID del proyecto a actualizar
   * @param {Object} projectData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async update(id, projectData) {
    try {
      const fields = [];
      const values = [];
      
      // Construir consulta dinámica con solo los campos a actualizar
      const updateableFields = [
        'name', 'code', 'client_id', 'status', 'start_date', 'expected_end_date', 
        'actual_end_date', 'total_budget', 'description', 'location', 
        'location_lat', 'location_lon'
      ];
      
      updateableFields.forEach(field => {
        if (projectData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(projectData[field]);
        }
      });
      
      // Si no hay campos para actualizar, retornar
      if (fields.length === 0) {
        return false;
      }
      
      // Añadir ID al final de los parámetros
      values.push(id);
      
      // Ejecutar actualización
      const [result] = await pool.query(
        `UPDATE construction_projects SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en update:', error.message);
      throw error;
    }
  },

  /**
   * Elimina un proyecto
   * @param {number} id - ID del proyecto a eliminar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async delete(id) {
    try {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Eliminar el proyecto (las tablas relacionadas se eliminarán por CASCADE)
        const [result] = await connection.query(
          'DELETE FROM construction_projects WHERE id = ?',
          [id]
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
      console.error('Error en delete:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza el estado de un proyecto
   * @param {number} id - ID del proyecto
   * @param {string} status - Nuevo estado
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateStatus(id, status) {
    try {
      // Validar estado
      const validStatus = ['draft', 'in_progress', 'completed', 'cancelled'];
      if (!validStatus.includes(status)) {
        throw new Error('Estado de proyecto no válido');
      }
      
      const [result] = await pool.query(
        'UPDATE construction_projects SET status = ? WHERE id = ?',
        [status, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateStatus:', error.message);
      throw error;
    }
  },

  /**
   * Lista los proyectos con filtros y paginación
   * @param {Object} filters - Filtros a aplicar
   * @param {number} page - Número de página
   * @param {number} limit - Límite de resultados por página
   * @returns {Promise<Object>} Lista de proyectos y metadatos de paginación
   */
  async listProjects(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const whereConditions = [];
      const queryParams = [];
      
      // Aplicar filtros
      if (filters.owner_id) {
        whereConditions.push('owner_id = ?');
        queryParams.push(filters.owner_id);
      }
      
      if (filters.status) {
        whereConditions.push('status = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.search) {
        whereConditions.push('(name LIKE ? OR code LIKE ? OR description LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }
      
      if (filters.start_date_from) {
        whereConditions.push('start_date >= ?');
        queryParams.push(filters.start_date_from);
      }
      
      if (filters.start_date_to) {
        whereConditions.push('start_date <= ?');
        queryParams.push(filters.start_date_to);
      }
      
      // Construir la cláusula WHERE
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Obtener proyectos
      const [rows] = await pool.query(
        `SELECT * FROM construction_projects 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );
      
      // Obtener total de proyectos para la paginación
      const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM construction_projects ${whereClause}`,
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
      console.error('Error en listProjects:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene resumen de estados de todos los proyectos
   * @returns {Promise<Object>} Resumen de estados
   */
  async getProjectStatusSummary() {
    try {
      const [results] = await pool.query(`
        SELECT 
          status, 
          COUNT(*) AS count,
          SUM(total_budget) AS total_budget
        FROM construction_projects 
        GROUP BY status
      `);
      
      return results;
    } catch (error) {
      console.error('Error en getProjectStatusSummary:', error.message);
      throw error;
    }
  }
};