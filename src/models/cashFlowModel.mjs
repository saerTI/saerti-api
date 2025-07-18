import { pool } from '../config/database.mjs';

/**
 * Modelo de Flujo de Caja para gestionar las operaciones relacionadas con transacciones financieras
 */
export default {
  /**
   * Obtiene las categorías de flujo de caja
   * @param {string} [type] - Filtrar por tipo (income, expense, both)
   * @param {boolean} [activeOnly=true] - Mostrar solo categorías activas
   * @returns {Promise<Array>} Lista de categorías
   */
  async getCategories(type, activeOnly = true) {
    try {
      let query = 'SELECT * FROM cash_flow_categories';
      const params = [];
      const conditions = [];
      
      // Filtrar por tipo
      if (type && ['income', 'expense', 'both'].includes(type)) {
        conditions.push('(type = ? OR type = "both")');
        params.push(type);
      }
      
      // Filtrar por estado
      if (activeOnly) {
        conditions.push('active = TRUE');
      }
      
      // Añadir condiciones a la consulta
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Ordenar por nombre
      query += ' ORDER BY name ASC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error en getCategories:', error.message);
      throw error;
    }
  },

  /**
   * Crea una nueva categoría de flujo de caja
   * @param {Object} categoryData - Datos de la categoría
   * @returns {Promise<Object>} Categoría creada
   */
  async createCategory(categoryData) {
    try {
      const [result] = await pool.query(
        'INSERT INTO cash_flow_categories (name, type, parent_id, active) VALUES (?, ?, ?, ?)',
        [
          categoryData.name,
          categoryData.type || 'both',
          categoryData.parent_id || null,
          categoryData.active !== undefined ? categoryData.active : true
        ]
      );
      
      const [categories] = await pool.query(
        'SELECT * FROM cash_flow_categories WHERE id = ?',
        [result.insertId]
      );
      
      return categories[0];
    } catch (error) {
      console.error('Error en createCategory:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza una categoría de flujo de caja
   * @param {number} id - ID de la categoría
   * @param {Object} categoryData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateCategory(id, categoryData) {
    try {
      const fields = [];
      const values = [];
      
      // Construir consulta dinámica
      if (categoryData.name !== undefined) {
        fields.push('name = ?');
        values.push(categoryData.name);
      }
      
      if (categoryData.type !== undefined) {
        fields.push('type = ?');
        values.push(categoryData.type);
      }
      
      if (categoryData.parent_id !== undefined) {
        fields.push('parent_id = ?');
        values.push(categoryData.parent_id);
      }
      
      if (categoryData.active !== undefined) {
        fields.push('active = ?');
        values.push(categoryData.active);
      }
      
      // Si no hay campos para actualizar, retornar
      if (fields.length === 0) {
        return false;
      }
      
      // Añadir ID al final
      values.push(id);
      
      const [result] = await pool.query(
        `UPDATE cash_flow_categories SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateCategory:', error.message);
      throw error;
    }
  },

  /**
   * Crea una nueva línea de flujo de caja
   * @param {Object} lineData - Datos de la línea
   * @returns {Promise<Object>} Línea creada
   */
  async createLine(lineData) {
    try {
      const [result] = await pool.query(
        `INSERT INTO cash_flow_lines 
         (cost_center_id, name, category_id, type, planned_date, actual_date, amount, state, partner_id, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lineData.cost_center_id,
          lineData.name,
          lineData.category_id,
          lineData.type,
          lineData.planned_date,
          lineData.actual_date || null,
          lineData.amount,
          lineData.state || 'forecast',
          lineData.partner_id || null,
          lineData.notes || null
        ]
      );
      
      const [lines] = await pool.query(
        'SELECT * FROM cash_flow_lines WHERE id = ?',
        [result.insertId]
      );
      
      return lines[0];
    } catch (error) {
      console.error('Error en createLine:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza una línea de flujo de caja
   * @param {number} id - ID de la línea
   * @param {Object} lineData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async updateLine(id, lineData) {
    try {
      const fields = [];
      const values = [];
      
      // Campos actualizables
      const updateableFields = [
        'name', 'category_id', 'planned_date', 'actual_date', 
        'amount', 'state', 'partner_id', 'notes'
      ];
      
      // Construir consulta dinámica
      updateableFields.forEach(field => {
        if (lineData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(lineData[field]);
        }
      });
      
      // Si no hay campos para actualizar, retornar
      if (fields.length === 0) {
        return false;
      }
      
      // Añadir ID al final
      values.push(id);
      
      const [result] = await pool.query(
        `UPDATE cash_flow_lines SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en updateLine:', error.message);
      throw error;
    }
  },

  /**
   * Elimina una línea de flujo de caja
   * @param {number} id - ID de la línea
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async deleteLine(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM cash_flow_lines WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en deleteLine:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene el flujo de caja de un proyecto
   * @param {number} projectId - ID del proyecto
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} Líneas del flujo de caja
   */
  async getProjectCashFlow(projectId, filters = {}) {
    try {
      let query = `
        SELECT cf.*, cat.name as category_name 
        FROM cash_flow_lines cf
        JOIN cash_flow_categories cat ON cf.category_id = cat.id
        WHERE cf.cost_center_id = ?
      `;
      
      const queryParams = [projectId];
      
      // Aplicar filtros adicionales
      if (filters.type) {
        query += ' AND cf.type = ?';
        queryParams.push(filters.type);
      }
      
      if (filters.state) {
        query += ' AND cf.state = ?';
        queryParams.push(filters.state);
      }
      
      if (filters.from_date) {
        query += ' AND (cf.planned_date >= ? OR cf.actual_date >= ?)';
        queryParams.push(filters.from_date, filters.from_date);
      }
      
      if (filters.to_date) {
        query += ' AND (cf.planned_date <= ? OR cf.actual_date <= ?)';
        queryParams.push(filters.to_date, filters.to_date);
      }
      
      // Ordenar resultados
      query += ' ORDER BY cf.planned_date ASC, cf.actual_date ASC';
      
      const [rows] = await pool.query(query, queryParams);
      return rows;
    } catch (error) {
      console.error('Error en getProjectCashFlow:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene un resumen del flujo de caja para un proyecto
   * @param {number} projectId - ID del proyecto
   * @returns {Promise<Object>} Resumen del flujo de caja
   */
  async getCashFlowSummary(projectId) {
    try {
      // Obtener totales de ingresos y gastos
      const [summary] = await pool.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type = 'income' AND state = 'actual' THEN amount ELSE 0 END) as actual_income,
          SUM(CASE WHEN type = 'expense' AND state = 'actual' THEN amount ELSE 0 END) as actual_expense,
          SUM(CASE WHEN type = 'income' AND state = 'forecast' THEN amount ELSE 0 END) as forecast_income,
          SUM(CASE WHEN type = 'expense' AND state = 'forecast' THEN amount ELSE 0 END) as forecast_expense
        FROM cash_flow_lines
        WHERE cost_center_id = ?
      `, [projectId]);
      
      // Calcular saldos
      const result = summary[0];
      result.net_cash_flow = (result.total_income || 0) - (result.total_expense || 0);
      result.actual_net_cash_flow = (result.actual_income || 0) - (result.actual_expense || 0);
      result.forecast_net_cash_flow = (result.forecast_income || 0) - (result.forecast_expense || 0);
      
      return result;
    } catch (error) {
      console.error('Error en getCashFlowSummary:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene el flujo de caja mensual para informes
   * @param {number} projectId - ID del proyecto
   * @param {number} year - Año a filtrar
   * @returns {Promise<Array>} Datos de flujo de caja mensual
   */
  async getMonthlyCashFlow(projectId, year) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          DATE_FORMAT(COALESCE(actual_date, planned_date), '%Y-%m') as month,
          type,
          SUM(amount) as total
        FROM cash_flow_lines
        WHERE cost_center_id = ? 
          AND YEAR(COALESCE(actual_date, planned_date)) = ?
        GROUP BY DATE_FORMAT(COALESCE(actual_date, planned_date), '%Y-%m'), type
        ORDER BY month
      `, [projectId, year]);
      
      // Organizar datos por mes
      const monthlyData = {};
      
      rows.forEach(row => {
        if (!monthlyData[row.month]) {
          monthlyData[row.month] = {
            month: row.month,
            income: 0,
            expense: 0,
            net: 0
          };
        }
        
        if (row.type === 'income') {
          monthlyData[row.month].income = parseFloat(row.total);
        } else if (row.type === 'expense') {
          monthlyData[row.month].expense = parseFloat(row.total);
        }
        
        // Recalcular saldo neto
        monthlyData[row.month].net = monthlyData[row.month].income - monthlyData[row.month].expense;
      });
      
      return Object.values(monthlyData);
    } catch (error) {
      console.error('Error en getMonthlyCashFlow:', error.message);
      throw error;
    }
  }
};