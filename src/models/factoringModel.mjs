// src/models/factoringModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Modelo de Factoring para gestionar las operaciones relacionadas con factoring
 */
export default {
  /**
   * Obtiene un factoring por su ID
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          f.id,
          f.factoring_entities_id,
          f.interest_rate,
          f.mount,
          f.cost_center_id,
          f.date_factoring,
          f.date_expiration,
          f.payment_status,
          f.status,
          f.created_at,
          f.updated_at,
          fe.name as entity_name,
          cc.name as cost_center_name
        FROM factoring f
        LEFT JOIN factoring_entities fe ON f.factoring_entities_id = fe.id
        LEFT JOIN cost_centers cc ON f.cost_center_id = cc.id
        WHERE f.id = ?
      `, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getById:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene todos los factorings con paginación y filtros
   * @param {number} page - Número de página
   * @param {number} limit - Límite de registros por página
   * @param {Object} filters - Filtros a aplicar
   * @param {string} filters.status - Estado del factoring
   * @param {number} filters.factoring_entities_id - ID de la entidad de factoring
   * @param {number} filters.cost_center_id - ID del centro de costos
   * @param {string} filters.date_from - Fecha desde
   * @param {string} filters.date_to - Fecha hasta
   */
  async getAll(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      console.log('🔍 FactoringModel.getAll - Getting factorings with page:', page, 'limit:', limit, 'offset:', offset);
      console.log('🔍 FactoringModel.getAll - Filters:', filters);
      
      // Construir la cláusula WHERE dinámica basada en los filtros
      let whereConditions = [];
      let queryParams = [];
      
      if (filters.status) {
        whereConditions.push('f.status = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.factoring_entities_id) {
        whereConditions.push('f.factoring_entities_id = ?');
        queryParams.push(filters.factoring_entities_id);
      }
      
      if (filters.cost_center_id) {
        whereConditions.push('f.cost_center_id = ?');
        queryParams.push(filters.cost_center_id);
      }
      
      if (filters.date_from) {
        whereConditions.push('f.date_factoring >= ?');
        queryParams.push(filters.date_from);
      }
      
      if (filters.date_to) {
        whereConditions.push('f.date_factoring <= ?');
        queryParams.push(filters.date_to);
      }
      
      // Construir la cláusula WHERE si hay condiciones
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
        
      console.log('🔍 FactoringModel.getAll - WHERE clause:', whereClause);
      console.log('🔍 FactoringModel.getAll - Query parameters:', queryParams);
      
      // Query para contar el total de registros con los filtros aplicados
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM factoring f
        ${whereClause}
      `;
      
      const [totalRows] = await pool.query(countQuery, queryParams);
      const total = totalRows[0].total;
      console.log('📊 FactoringModel.getAll - Total factorings found with filters:', total);
      
      // Añadir los parámetros de paginación
      const allParams = [...queryParams, limit, offset];
      
      const [rows] = await pool.query(`
        SELECT 
          f.id,
          f.factoring_entities_id,
          f.interest_rate,
          f.mount,
          f.cost_center_id,
          f.date_factoring,
          f.date_expiration,
          f.payment_status,
          f.status,
          f.created_at,
          f.updated_at,
          fe.name as entity_name,
          cc.name as cost_center_name
        FROM factoring f
        LEFT JOIN factoring_entities fe ON f.factoring_entities_id = fe.id
        LEFT JOIN cost_centers cc ON f.cost_center_id = cc.id
        ${whereClause}
        ORDER BY f.date_factoring DESC
        LIMIT ? OFFSET ?
      `, allParams);
      
      console.log('📋 FactoringModel.getAll - Query result rows length:', rows.length);
      if (rows.length > 0) {
        console.log('📋 FactoringModel.getAll - Sample row:', rows[0]);
      }
      
      const result = {
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
      
      console.log('✅ FactoringModel.getAll - Returning result structure:', {
        dataLength: result.data?.length,
        pagination: result.pagination
      });
      
      return result;
    } catch (error) {
      console.error('Error en getAll:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene factorings por centro de costos
   */
  async getByCostCenter(costCenterId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          f.id,
          f.factoring_entities_id,
          f.interest_rate,
          f.mount,
          f.cost_center_id,
          f.date_factoring,
          f.date_expiration,
          f.payment_status,
          f.status,
          f.created_at,
          f.updated_at,
          fe.name as entity_name,
          cc.name as cost_center_name
        FROM factoring f
        LEFT JOIN factoring_entities fe ON f.factoring_entities_id = fe.id
        LEFT JOIN cost_centers cc ON f.cost_center_id = cc.id
        WHERE f.cost_center_id = ?
        ORDER BY f.date_factoring DESC
      `, [costCenterId]);
      
      return rows;
    } catch (error) {
      console.error('Error en getByCostCenter:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene factorings por estado
   */
  async getByStatus(status) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          f.id,
          f.factoring_entities_id,
          f.interest_rate,
          f.mount,
          f.cost_center_id,
          f.date_factoring,
          f.date_expiration,
          f.payment_status,
          f.status,
          f.created_at,
          f.updated_at,
          fe.name as entity_name,
          cc.name as cost_center_name
        FROM factoring f
        LEFT JOIN factoring_entities fe ON f.factoring_entities_id = fe.id
        LEFT JOIN cost_centers cc ON f.cost_center_id = cc.id
        WHERE f.status = ?
        ORDER BY f.date_factoring DESC
      `, [status]);
      
      return rows;
    } catch (error) {
      console.error('Error en getByStatus:', error.message);
      throw error;
    }
  },

  /**
   * Crea un nuevo factoring
   */
  async create(factoringData) {
    try {
      const {
        factoring_entities_id,
        interest_rate,
        mount,
        cost_center_id,
        date_factoring,
        date_expiration,
        payment_status = 0,
        status = 'Pendiente'
      } = factoringData;

      // Validar que las entidades referenciadas existen
      const [entityExists] = await pool.query(
        'SELECT id FROM factoring_entities WHERE id = ?',
        [factoring_entities_id]
      );
      
      if (entityExists.length === 0) {
        throw new Error('La entidad de factoring especificada no existe');
      }

      const [costCenterExists] = await pool.query(
        'SELECT id FROM cost_centers WHERE id = ?',
        [cost_center_id]
      );
      
      if (costCenterExists.length === 0) {
        throw new Error('El centro de costos especificado no existe');
      }

      // Convert ISO string dates to MySQL compatible date format
      const formattedDateFactoring = date_factoring ? new Date(date_factoring).toISOString().slice(0, 19).replace('T', ' ') : null;
      const formattedDateExpiration = date_expiration ? new Date(date_expiration).toISOString().slice(0, 19).replace('T', ' ') : null;

      const [result] = await pool.query(`
        INSERT INTO factoring (
          factoring_entities_id,
          interest_rate,
          mount,
          cost_center_id,
          date_factoring,
          date_expiration,
          payment_status,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        factoring_entities_id,
        interest_rate,
        mount,
        cost_center_id,
        formattedDateFactoring,
        formattedDateExpiration,
        payment_status,
        status
      ]);

      return await this.getById(result.insertId);
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza un factoring
   */
  async update(id, factoringData) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Factoring no encontrado');
      }

      const {
        factoring_entities_id,
        interest_rate,
        mount,
        cost_center_id,
        date_factoring,
        date_expiration,
        payment_status,
        status
      } = factoringData;

      // Validar entidades referenciadas si se proporcionan
      if (factoring_entities_id) {
        const [entityExists] = await pool.query(
          'SELECT id FROM factoring_entities WHERE id = ?',
          [factoring_entities_id]
        );
        
        if (entityExists.length === 0) {
          throw new Error('La entidad de factoring especificada no existe');
        }
      }

      if (cost_center_id) {
        const [costCenterExists] = await pool.query(
          'SELECT id FROM cost_centers WHERE id = ?',
          [cost_center_id]
        );
        
        if (costCenterExists.length === 0) {
          throw new Error('El centro de costos especificado no existe');
        }
      }

      const fields = [];
      const values = [];

      if (factoring_entities_id !== undefined) {
        fields.push('factoring_entities_id = ?');
        values.push(factoring_entities_id);
      }
      if (interest_rate !== undefined) {
        fields.push('interest_rate = ?');
        values.push(interest_rate);
      }
      if (mount !== undefined) {
        fields.push('mount = ?');
        values.push(mount);
      }
      if (cost_center_id !== undefined) {
        fields.push('cost_center_id = ?');
        values.push(cost_center_id);
      }
      if (date_factoring !== undefined) {
        fields.push('date_factoring = ?');
        // Convert ISO string to MySQL compatible date format
        const formattedDateFactoring = new Date(date_factoring).toISOString().slice(0, 19).replace('T', ' ');
        values.push(formattedDateFactoring);
      }
      if (date_expiration !== undefined) {
        fields.push('date_expiration = ?');
        // Convert ISO string to MySQL compatible date format
        const formattedDateExpiration = new Date(date_expiration).toISOString().slice(0, 19).replace('T', ' ');
        values.push(formattedDateExpiration);
      }
      if (payment_status !== undefined) {
        fields.push('payment_status = ?');
        values.push(payment_status);
      }
      if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      if (fields.length === 1) { // Solo updated_at
        throw new Error('No hay campos para actualizar');
      }

      await pool.query(`
        UPDATE factoring 
        SET ${fields.join(', ')}
        WHERE id = ?
      `, values);

      return await this.getById(id);
    } catch (error) {
      console.error('Error en update:', error.message);
      throw error;
    }
  },

  /**
   * Elimina un factoring
   */
  async delete(id) {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Factoring no encontrado');
      }

      const [result] = await pool.query(
        'DELETE FROM factoring WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete:', error.message);
      throw error;
    }
  },

  /**
   * Cuenta el número total de factorings
   */
  async count() {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM factoring'
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error en count:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene factorings próximos a vencer
   */
  async getExpiringSoon(days = 30) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          f.id,
          f.factoring_entities_id,
          f.interest_rate,
          f.mount,
          f.cost_center_id,
          f.date_factoring,
          f.date_expiration,
          f.payment_status,
          f.status,
          f.created_at,
          f.updated_at,
          fe.name as entity_name,
          cc.name as cost_center_name,
          DATEDIFF(f.date_expiration, CURDATE()) as days_to_expire
        FROM factoring f
        LEFT JOIN factoring_entities fe ON f.factoring_entities_id = fe.id
        LEFT JOIN cost_centers cc ON f.cost_center_id = cc.id
        WHERE f.date_expiration <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND f.status != 'Girado y pagado'
        ORDER BY f.date_expiration ASC
      `, [days]);
      
      return rows;
    } catch (error) {
      console.error('Error en getExpiringSoon:', error.message);
      throw error;
    }
  },

  /**
   * Calcula los montos totales de factorings según los filtros aplicados y desglosado por estados
   * @param {Object} filters - Filtros a aplicar
   */
  async getTotalAmounts(filters = {}) {
    try {
      // Construir la cláusula WHERE dinámica basada en los filtros
      let whereConditions = [];
      let queryParams = [];
      
      if (filters.status) {
        whereConditions.push('f.status = ?');
        queryParams.push(filters.status);
      }
      
      if (filters.factoring_entities_id) {
        whereConditions.push('f.factoring_entities_id = ?');
        queryParams.push(filters.factoring_entities_id);
      }
      
      if (filters.cost_center_id) {
        whereConditions.push('f.cost_center_id = ?');
        queryParams.push(filters.cost_center_id);
      }
      
      if (filters.date_from) {
        whereConditions.push('f.date_factoring >= ?');
        queryParams.push(filters.date_from);
      }
      
      if (filters.date_to) {
        whereConditions.push('f.date_factoring <= ?');
        queryParams.push(filters.date_to);
      }
      
      // Construir la cláusula WHERE si hay condiciones
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
        
      console.log('🔍 FactoringModel.getTotalAmounts - WHERE clause:', whereClause);
      console.log('🔍 FactoringModel.getTotalAmounts - Query parameters:', queryParams);
      
      // Query para obtener las sumas totales por estado
      const query = `
        SELECT 
          SUM(mount) as total_amount,
          SUM(CASE WHEN status = 'Pendiente' THEN mount ELSE 0 END) as total_pendiente,
          SUM(CASE WHEN status = 'Girado y no pagado' THEN mount ELSE 0 END) as total_giradoynopagado,
          SUM(CASE WHEN status = 'Girado y pagado' THEN mount ELSE 0 END) as total_giradoypagado
        FROM factoring f
        ${whereClause}
      `;
      
      const [result] = await pool.query(query, queryParams);
      
      // Asegurar que los valores son números y no null
      const totalAmount = parseFloat(result[0].total_amount || 0);
      const totalPendiente = parseFloat(result[0].total_pendiente || 0);
      const totalGiradoYNoPagado = parseFloat(result[0].total_giradoynopagado || 0);
      const totalGiradoYPagado = parseFloat(result[0].total_giradoypagado || 0);
      
      console.log('💰 FactoringModel.getTotalAmounts - Totals:', {
        total: totalAmount,
        pendiente: totalPendiente,
        giradoYNoPagado: totalGiradoYNoPagado,
        giradoYPagado: totalGiradoYPagado
      });
      
      return {
        total_amount: totalAmount,
        total_pendiente: totalPendiente,
        total_giradoynopagado: totalGiradoYNoPagado,
        total_giradoypagado: totalGiradoYPagado
      };
    } catch (error) {
      console.error('Error en getTotalAmounts:', error.message);
      throw error;
    }
  }
};