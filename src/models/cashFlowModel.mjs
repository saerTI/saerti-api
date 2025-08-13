// src/models/cashFlowModel.mjs - Modelo extendido con funciones similares a costsModel
import { pool } from '../config/database.mjs';

// ==========================================
// FUNCIONES PRINCIPALES PARA DASHBOARD
// ==========================================

/**
 * Obtiene un resumen completo del flujo de caja
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Object>} Resumen del flujo de caja
 */
const getSummary = async (filters = {}) => {
  try {
    let whereConditions = [];
    let queryParams = [];

    // Construir filtros dinámicamente
    if (filters.year) {
      whereConditions.push('YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ?');
      queryParams.push(filters.year);
    }

    if (filters.project_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.project_id);
    }

    if (filters.cost_center_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.cost_center_id);
    }

    if (filters.category_id) {
      whereConditions.push('cf.category_id = ?');
      queryParams.push(filters.category_id);
    }

    if (filters.state) {
      whereConditions.push('cf.state = ?');
      queryParams.push(filters.state);
    }

    if (filters.type) {
      whereConditions.push('cf.type = ?');
      queryParams.push(filters.type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN cf.type = 'income' AND cf.state = 'forecast' THEN cf.amount ELSE 0 END) as forecast_income,
        SUM(CASE WHEN cf.type = 'expense' AND cf.state = 'forecast' THEN cf.amount ELSE 0 END) as forecast_expense,
        SUM(CASE WHEN cf.type = 'income' AND cf.state = 'actual' THEN cf.amount ELSE 0 END) as actual_income,
        SUM(CASE WHEN cf.type = 'expense' AND cf.state = 'actual' THEN cf.amount ELSE 0 END) as actual_expense,
        COUNT(CASE WHEN cf.state = 'forecast' THEN 1 END) as pending_items,
        COUNT(*) as total_items
      FROM cash_flow_lines cf
      LEFT JOIN cash_flow_categories cat ON cf.category_id = cat.id
      LEFT JOIN cost_centers cc ON cf.cost_center_id = cc.id
      ${whereClause}
    `;

    const [rows] = await pool.query(query, queryParams);
    const summary = rows[0] || {};

    // Calcular cambio del período anterior (placeholder - implementar lógica específica)
    summary.previous_period_change = 0;

    return summary;
  } catch (error) {
    console.error('Error en getSummary:', error.message);
    throw error;
  }
};

/**
 * Obtiene los movimientos más recientes
 * @param {Object} filters - Filtros para la consulta
 * @param {number} limit - Número de registros a retornar
 * @returns {Promise<Array>} Array de movimientos recientes
 */
const getRecentItems = async (filters = {}, limit = 10) => {
  try {
    let whereConditions = [];
    let queryParams = [];

    // Aplicar filtros
    if (filters.year) {
      whereConditions.push('YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ?');
      queryParams.push(filters.year);
    }

    if (filters.project_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.project_id);
    }

    if (filters.cost_center_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.cost_center_id);
    }

    if (filters.category_id) {
      whereConditions.push('cf.category_id = ?');
      queryParams.push(filters.category_id);
    }

    if (filters.state) {
      whereConditions.push('cf.state = ?');
      queryParams.push(filters.state);
    }

    if (filters.type) {
      whereConditions.push('cf.type = ?');
      queryParams.push(filters.type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        cf.*,
        cat.name as category_name,
        cc.name as cost_center_name
      FROM cash_flow_lines cf
      LEFT JOIN cash_flow_categories cat ON cf.category_id = cat.id
      LEFT JOIN cost_centers cc ON cf.cost_center_id = cc.id
      ${whereClause}
      ORDER BY COALESCE(cf.actual_date, cf.planned_date) DESC
      LIMIT ?
    `;

    queryParams.push(limit);
    const [rows] = await pool.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('Error en getRecentItems:', error.message);
    throw error;
  }
};

/**
 * Obtiene datos agrupados por categoría
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Array>} Array de categorías con totales
 */
const getByCategory = async (filters = {}) => {
  try {
    let whereConditions = [];
    let queryParams = [];

    // Aplicar filtros
    if (filters.year) {
      whereConditions.push('YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ?');
      queryParams.push(filters.year);
    }

    if (filters.project_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.project_id);
    }

    if (filters.cost_center_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.cost_center_id);
    }

    if (filters.state) {
      whereConditions.push('cf.state = ?');
      queryParams.push(filters.state);
    }

    if (filters.type) {
      whereConditions.push('cf.type = ?');
      queryParams.push(filters.type);
    }

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        cat.id as category_id,
        cat.name as category_name,
        cat.type as category_type,
        SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as income_amount,
        SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END) as expense_amount,
        SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE -cf.amount END) as net_amount,
        COUNT(cf.id) as items_count
      FROM cash_flow_categories cat
      LEFT JOIN cash_flow_lines cf ON cat.id = cf.category_id ${whereClause}
      WHERE cat.active = 1
      GROUP BY cat.id, cat.name, cat.type
      HAVING items_count > 0
      ORDER BY net_amount DESC
    `;

    const [rows] = await pool.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('Error en getByCategory:', error.message);
    throw error;
  }
};

/**
 * Obtiene categorías sin movimientos
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Array>} Array de categorías vacías
 */
const getEmptyCategories = async (filters = {}) => {
  try {
    let whereConditions = [];
    let queryParams = [];

    // Aplicar filtros para las líneas existentes
    if (filters.year) {
      whereConditions.push('YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ?');
      queryParams.push(filters.year);
    }

    if (filters.project_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.project_id);
    }

    if (filters.cost_center_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.cost_center_id);
    }

    if (filters.state) {
      whereConditions.push('cf.state = ?');
      queryParams.push(filters.state);
    }

    if (filters.type) {
      whereConditions.push('cf.type = ?');
      queryParams.push(filters.type);
    }

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        cat.id as category_id,
        cat.name as category_name,
        cat.type as category_type
      FROM cash_flow_categories cat
      LEFT JOIN cash_flow_lines cf ON cat.id = cf.category_id ${whereClause}
      WHERE cat.active = 1 AND cf.id IS NULL
      ORDER BY cat.name
    `;

    const [rows] = await pool.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('Error en getEmptyCategories:', error.message);
    throw error;
  }
};

/**
 * Obtiene datos para gráficos por período
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Array>} Array de datos por período
 */
const getChartData = async (filters = {}) => {
  try {
    const periods = getPeriodConfig(filters.period_type || 'monthly', filters.year || new Date().getFullYear());
    
    let whereConditions = ['cf.category_id = cat.id'];
    let queryParams = [];

    // Aplicar filtros adicionales
    if (filters.project_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.project_id);
    }

    if (filters.cost_center_id) {
      whereConditions.push('cf.cost_center_id = ?');
      queryParams.push(filters.cost_center_id);
    }

    if (filters.category_id) {
      whereConditions.push('cf.category_id = ?');
      queryParams.push(filters.category_id);
    }

    if (filters.state) {
      whereConditions.push('cf.state = ?');
      queryParams.push(filters.state);
    }

    if (filters.type) {
      whereConditions.push('cf.type = ?');
      queryParams.push(filters.type);
    }

    const results = [];

    for (const period of periods) {
      const periodCondition = `${period.condition}`;
      const finalWhereConditions = [...whereConditions, periodCondition];
      
      const query = `
        SELECT 
          SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as income,
          SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END) as expense,
          SUM(CASE WHEN cf.type = 'income' AND cf.state = 'forecast' THEN cf.amount ELSE 0 END) as forecast_income,
          SUM(CASE WHEN cf.type = 'expense' AND cf.state = 'forecast' THEN cf.amount ELSE 0 END) as forecast_expense,
          SUM(CASE WHEN cf.type = 'income' AND cf.state = 'actual' THEN cf.amount ELSE 0 END) as actual_income,
          SUM(CASE WHEN cf.type = 'expense' AND cf.state = 'actual' THEN cf.amount ELSE 0 END) as actual_expense
        FROM cash_flow_lines cf
        LEFT JOIN cash_flow_categories cat ON cf.category_id = cat.id
        WHERE ${finalWhereConditions.join(' AND ')}
      `;

      const [periodRows] = await pool.query(query, queryParams);
      const periodData = periodRows[0] || {};
      
      results.push({
        period_name: period.name,
        income: parseFloat(periodData.income || 0),
        expense: parseFloat(periodData.expense || 0),
        balance: parseFloat(periodData.income || 0) - parseFloat(periodData.expense || 0),
        forecast_income: parseFloat(periodData.forecast_income || 0),
        forecast_expense: parseFloat(periodData.forecast_expense || 0),
        actual_income: parseFloat(periodData.actual_income || 0),
        actual_expense: parseFloat(periodData.actual_expense || 0)
      });
    }

    return results;
  } catch (error) {
    console.error('Error en getChartData:', error.message);
    throw error;
  }
};

/**
 * Obtiene datos agrupados por período para tabla financiera
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Array>} Array de datos por período
 */
const getByPeriod = async (filters = {}) => {
  return await getChartData(filters); // Reutilizar la misma lógica
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Genera configuración de períodos según el tipo
 * @param {string} periodType - Tipo de período (monthly, weekly, quarterly, annual)
 * @param {number} year - Año para generar períodos
 * @returns {Array} Array de configuraciones de período
 */
const getPeriodConfig = (periodType, year) => {
  switch (periodType) {
    case 'weekly':
      return generateWeeklyPeriods(year);
    case 'quarterly':
      return generateQuarterlyPeriods(year);
    case 'annual':
      return generateAnnualPeriods(year);
    case 'monthly':
    default:
      return generateMonthlyPeriods(year);
  }
};

/**
 * Genera períodos mensuales
 */
const generateMonthlyPeriods = (year) => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  return months.map((month, index) => ({
    name: month,
    condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND MONTH(COALESCE(cf.actual_date, cf.planned_date)) = ${index + 1}`
  }));
};

/**
 * Genera períodos semanales (primeras 12 semanas del año)
 */
const generateWeeklyPeriods = (year) => {
  const periods = [];
  for (let week = 1; week <= 12; week++) {
    periods.push({
      name: `Semana ${week}`,
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND WEEK(COALESCE(cf.actual_date, cf.planned_date), 1) = ${week}`
    });
  }
  return periods;
};

/**
 * Genera períodos trimestrales
 */
const generateQuarterlyPeriods = (year) => {
  return [
    {
      name: 'Q1',
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND QUARTER(COALESCE(cf.actual_date, cf.planned_date)) = 1`
    },
    {
      name: 'Q2', 
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND QUARTER(COALESCE(cf.actual_date, cf.planned_date)) = 2`
    },
    {
      name: 'Q3',
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND QUARTER(COALESCE(cf.actual_date, cf.planned_date)) = 3`
    },
    {
      name: 'Q4',
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${year} AND QUARTER(COALESCE(cf.actual_date, cf.planned_date)) = 4`
    }
  ];
};

/**
 * Genera períodos anuales (últimos 5 años)
 */
const generateAnnualPeriods = (year) => {
  const periods = [];
  for (let i = 4; i >= 0; i--) {
    const periodYear = year - i;
    periods.push({
      name: periodYear.toString(),
      condition: `YEAR(COALESCE(cf.actual_date, cf.planned_date)) = ${periodYear}`
    });
  }
  return periods;
};

// ==========================================
// FUNCIONES PARA FILTROS
// ==========================================

/**
 * Obtiene proyectos (centros de costo tipo 'project')
 */
const getProjects = async () => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, code
      FROM cost_centers 
      WHERE type = 'project' AND active = 1
      ORDER BY name
    `);
    return rows;
  } catch (error) {
    console.error('Error en getProjects:', error.message);
    throw error;
  }
};

/**
 * Obtiene todos los centros de costo
 */
const getCostCenters = async () => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, code, type
      FROM cost_centers 
      WHERE active = 1
      ORDER BY type, name
    `);
    return rows;
  } catch (error) {
    console.error('Error en getCostCenters:', error.message);
    throw error;
  }
};

/**
 * Obtiene categorías de flujo de caja
 */
const getCategories = async () => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, type, parent_id, active
      FROM cash_flow_categories 
      WHERE active = 1
      ORDER BY type, name
    `);
    return rows;
  } catch (error) {
    console.error('Error en getCategories:', error.message);
    throw error;
  }
};

// ==========================================
// CRUD OPERACIONES EXISTENTES
// ==========================================

/**
 * Crea una nueva categoría de flujo de caja
 * @param {Object} categoryData - Datos de la categoría
 * @returns {Promise<number>} ID de la categoría creada
 */
const createCategory = async (categoryData) => {
  try {
    const [result] = await pool.query(
      `INSERT INTO cash_flow_categories (name, type, parent_id, active) 
       VALUES (?, ?, ?, ?)`,
      [
        categoryData.name,
        categoryData.type || 'both',
        categoryData.parent_id || null,
        categoryData.active !== undefined ? categoryData.active : 1
      ]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('Error en createCategory:', error.message);
    throw error;
  }
};

/**
 * Actualiza una categoría de flujo de caja
 * @param {number} id - ID de la categoría
 * @param {Object} categoryData - Datos a actualizar
 * @returns {Promise<boolean>} Resultado de la operación
 */
const updateCategory = async (id, categoryData) => {
  try {
    const fields = [];
    const values = [];
    
    // Campos actualizables
    const updateableFields = ['name', 'type', 'parent_id', 'active'];
    
    updateableFields.forEach(field => {
      if (categoryData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(categoryData[field]);
      }
    });
    
    if (fields.length === 0) {
      return false;
    }
    
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
};

/**
 * Crea una nueva línea de flujo de caja
 * @param {Object} lineData - Datos de la línea
 * @returns {Promise<number>} ID de la línea creada
 */
const createLine = async (lineData) => {
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
    
    return result.insertId;
  } catch (error) {
    console.error('Error en createLine:', error.message);
    throw error;
  }
};

/**
 * Actualiza una línea de flujo de caja
 * @param {number} id - ID de la línea
 * @param {Object} lineData - Datos a actualizar
 * @returns {Promise<boolean>} Resultado de la operación
 */
const updateLine = async (id, lineData) => {
  try {
    const fields = [];
    const values = [];
    
    // Campos actualizables
    const updateableFields = [
      'name', 'category_id', 'planned_date', 'actual_date', 
      'amount', 'state', 'partner_id', 'notes'
    ];
    
    updateableFields.forEach(field => {
      if (lineData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(lineData[field]);
      }
    });
    
    if (fields.length === 0) {
      return false;
    }
    
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
};

/**
 * Elimina una línea de flujo de caja
 * @param {number} id - ID de la línea
 * @returns {Promise<boolean>} Resultado de la operación
 */
const deleteLine = async (id) => {
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
};

/**
 * Obtiene el flujo de caja de un proyecto
 * @param {number} projectId - ID del proyecto
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Líneas del flujo de caja
 */
const getProjectCashFlow = async (projectId, filters = {}) => {
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
};

/**
 * Obtiene un resumen del flujo de caja para un proyecto
 * @param {number} projectId - ID del proyecto
 * @returns {Promise<Object>} Resumen del flujo de caja
 */
const getCashFlowSummary = async (projectId) => {
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

    return summary[0];
  } catch (error) {
    console.error('Error en getCashFlowSummary:', error.message);
    throw error;
  }
};

// ==========================================
// FUNCIONES ADICIONALES PARA COMPATIBILIDAD
// ==========================================

/**
 * Crea un ingreso para un proyecto (compatibilidad con rutas existentes)
 * @param {number} projectId - ID del proyecto
 * @param {Object} incomeData - Datos del ingreso
 * @returns {Promise<number>} ID del ingreso creado
 */
const createIncome = async (projectId, incomeData) => {
  try {
    const lineData = {
      ...incomeData,
      cost_center_id: projectId,
      type: 'income'
    };
    
    return await createLine(lineData);
  } catch (error) {
    console.error('Error en createIncome:', error.message);
    throw error;
  }
};

/**
 * Crea un gasto para un proyecto (compatibilidad con rutas existentes)
 * @param {number} projectId - ID del proyecto
 * @param {Object} expenseData - Datos del gasto
 * @returns {Promise<number>} ID del gasto creado
 */
const createExpense = async (projectId, expenseData) => {
  try {
    const lineData = {
      ...expenseData,
      cost_center_id: projectId,
      type: 'expense'
    };
    
    return await createLine(lineData);
  } catch (error) {
    console.error('Error en createExpense:', error.message);
    throw error;
  }
};

// ==========================================
// EXPORT DEFAULT
// ==========================================

export default {
  // Funciones principales para dashboard
  getSummary,
  getRecentItems,
  getByCategory,
  getEmptyCategories,
  getChartData,
  getByPeriod,
  
  // Funciones para filtros
  getProjects,
  getCostCenters,
  getCategories,
  
  // CRUD operaciones
  createCategory,
  updateCategory,
  createLine,
  updateLine,
  deleteLine,
  
  // Funciones de proyecto
  getProjectCashFlow,
  getCashFlowSummary,
  createIncome,
  createExpense
};