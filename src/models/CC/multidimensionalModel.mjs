// src/models/CC/multidimensionalModel.mjs
import { pool } from '../../config/database.mjs';

/**
 * Modelo para navegación multidimensional de costos
 * Funciona como un ecommerce: filtrar por múltiples dimensiones
 */
export default {

  // ==========================================
  // NAVEGACIÓN PRINCIPAL MULTIDIMENSIONAL
  // ==========================================

  /**
   * Explora costos con filtros multidimensionales
   * @param {Object} filters - Filtros aplicados
   * @param {Object} pagination - Configuración de paginación
   * @returns {Promise<Object>} - Datos paginados y metadatos
   */
  async exploreCosts(filters = {}, pagination = {}) {
    try {
      // Configuración de paginación
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 25;
      const offset = (page - 1) * limit;

      // Construir filtros dinámicos
      let whereConditions = ['1=1'];
      let queryParams = [];

      // ✅ FILTROS PRINCIPALES (tipo ecommerce)
      
      // Por tipo de transacción (ingreso/gasto)
      if (filters.transaction_type) {
        whereConditions.push('transaction_type = ?');
        queryParams.push(filters.transaction_type);
      }

      // Por centro de costo (como "brand")
      if (filters.cost_center_id) {
        whereConditions.push('cost_center_id = ?');
        queryParams.push(filters.cost_center_id);
      }

      if (filters.cost_center_type) {
        whereConditions.push('cost_center_type = ?');
        queryParams.push(filters.cost_center_type);
      }

      // Por categoría contable (como "category")
      if (filters.category_id) {
        whereConditions.push('category_id = ?');
        queryParams.push(filters.category_id);
      }

      if (filters.category_group) {
        whereConditions.push('category_group = ?');
        queryParams.push(filters.category_group);
      }

      // Por empleado (como "tag")
      if (filters.employee_id) {
        whereConditions.push('employee_id = ?');
        queryParams.push(filters.employee_id);
      }

      if (filters.employee_department) {
        whereConditions.push('employee_department = ?');
        queryParams.push(filters.employee_department);
      }

      // Por proveedor (como "tag")
      if (filters.supplier_id) {
        whereConditions.push('supplier_id = ?');
        queryParams.push(filters.supplier_id);
      }

      // Por período
      if (filters.period_year) {
        whereConditions.push('period_year = ?');
        queryParams.push(filters.period_year);
      }

      if (filters.period_month) {
        whereConditions.push('period_month = ?');
        queryParams.push(filters.period_month);
      }

      // Por fuente (como "variant")
      if (filters.source_type) {
        whereConditions.push('source_type = ?');
        queryParams.push(filters.source_type);
      }

      // Por rango de montos
      if (filters.amount_min) {
        whereConditions.push('amount >= ?');
        queryParams.push(parseFloat(filters.amount_min));
      }

      if (filters.amount_max) {
        whereConditions.push('amount <= ?');
        queryParams.push(parseFloat(filters.amount_max));
      }

      // Por rango de fechas
      if (filters.date_from) {
        whereConditions.push('date >= ?');
        queryParams.push(filters.date_from);
      }

      if (filters.date_to) {
        whereConditions.push('date <= ?');
        queryParams.push(filters.date_to);
      }

      // Búsqueda de texto
      if (filters.search) {
        whereConditions.push(`(
          description LIKE ? OR 
          cost_center_name LIKE ? OR 
          category_name LIKE ? OR 
          supplier_name LIKE ? OR 
          employee_name LIKE ?
        )`);
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // ✅ ORDENAMIENTO
      let orderBy = 'date DESC, cost_id DESC';
      if (filters.sort) {
        const sortOptions = {
          'date_desc': 'date DESC',
          'date_asc': 'date ASC',
          'amount_desc': 'amount DESC',
          'amount_asc': 'amount ASC',
          'description': 'description ASC',
          'cost_center': 'cost_center_name ASC',
          'category': 'category_name ASC'
        };
        orderBy = sortOptions[filters.sort] || orderBy;
      }

      const whereClause = whereConditions.join(' AND ');

      // ✅ QUERY PRINCIPAL
      const dataQuery = `
        SELECT *
        FROM multidimensional_costs_view
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

      // ✅ QUERY DE CONTEO
      const countQuery = `
        SELECT COUNT(*) as total
        FROM multidimensional_costs_view
        WHERE ${whereClause}
      `;

      // Ejecutar ambas queries
      const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);
      const [countResult] = await pool.query(countQuery, queryParams);

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
      console.error('Error in exploreCosts model:', error);
      throw error;
    }
  },

  // ==========================================
  // DIMENSIONES PARA FILTROS DINÁMICOS
  // ==========================================

  /**
   * Obtiene todas las dimensiones disponibles para filtros
   * @param {Object} baseFilters - Filtros base para contexto
   * @returns {Promise<Object>} - Dimensiones disponibles
   */
  async getDimensions(baseFilters = {}) {
    try {
      // Query base para filtros contextuales
      let contextWhere = '';
      let contextParams = [];

      if (baseFilters.transaction_type) {
        contextWhere += contextWhere ? ' AND transaction_type = ?' : ' WHERE transaction_type = ?';
        contextParams.push(baseFilters.transaction_type);
      }

      if (baseFilters.cost_center_type) {
        contextWhere += contextWhere ? ' AND cost_center_type = ?' : ' WHERE cost_center_type = ?';
        contextParams.push(baseFilters.cost_center_type);
      }

      // ✅ CENTROS DE COSTO (como "brands")
      const [costCenters] = await pool.query(`
        SELECT DISTINCT 
          cost_center_id as id,
          cost_center_code as code,
          cost_center_name as name,
          cost_center_type as type,
          cost_center_client as client,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere}
        GROUP BY cost_center_id, cost_center_code, cost_center_name, cost_center_type, cost_center_client
        ORDER BY cost_count DESC
      `, contextParams);

      // ✅ CATEGORÍAS CONTABLES (como "categories")
      const [categories] = await pool.query(`
        SELECT DISTINCT 
          category_id as id,
          category_code as code,
          category_name as name,
          category_type as type,
          category_group as group_name,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere}
        GROUP BY category_id, category_code, category_name, category_type, category_group
        ORDER BY cost_count DESC
      `, contextParams);

      // ✅ EMPLEADOS (como "tags")
      const [employees] = await pool.query(`
        SELECT DISTINCT 
          employee_id as id,
          employee_tax_id as tax_id,
          employee_name as name,
          employee_position as position,
          employee_department as department,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere} ${contextWhere ? 'AND' : 'WHERE'} employee_id IS NOT NULL
        GROUP BY employee_id, employee_tax_id, employee_name, employee_position, employee_department
        ORDER BY cost_count DESC
      `, contextParams);

      // ✅ PROVEEDORES (como "tags")
      const [suppliers] = await pool.query(`
        SELECT DISTINCT 
          supplier_id as id,
          supplier_tax_id as tax_id,
          supplier_name as name,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere} ${contextWhere ? 'AND' : 'WHERE'} supplier_id IS NOT NULL
        GROUP BY supplier_id, supplier_tax_id, supplier_name
        ORDER BY cost_count DESC
      `, contextParams);

      // ✅ PERÍODOS DISPONIBLES
      const [periods] = await pool.query(`
        SELECT DISTINCT 
          period_year,
          period_month,
          period_key,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere}
        GROUP BY period_year, period_month, period_key
        ORDER BY period_year DESC, period_month DESC
      `, contextParams);

      // ✅ TIPOS DE FUENTE (como "variants")
      const [sourceTypes] = await pool.query(`
        SELECT DISTINCT 
          source_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        ${contextWhere}
        GROUP BY source_type
        ORDER BY cost_count DESC
      `, contextParams);

      return {
        cost_centers: costCenters,
        categories: categories,
        employees: employees,
        suppliers: suppliers,
        periods: periods,
        source_types: sourceTypes,
        totals: {
          total_costs: costCenters.reduce((sum, cc) => sum + cc.cost_count, 0),
          total_amount: costCenters.reduce((sum, cc) => sum + parseFloat(cc.total_amount || 0), 0)
        }
      };

    } catch (error) {
      console.error('Error in getDimensions model:', error);
      throw error;
    }
  },

  // ==========================================
  // DRILL-DOWN ESPECÍFICOS
  // ==========================================

  /**
   * Drill-down específico por centro de costo
   * @param {number} costCenterId - ID del centro de costo
   * @returns {Promise<Object>} - Análisis detallado del centro
   */
  async drillDownCostCenter(costCenterId) {
    try {
      // Info del centro de costo
      const [centerInfo] = await pool.query(`
        SELECT DISTINCT 
          cost_center_id as id,
          cost_center_code as code,
          cost_center_name as name,
          cost_center_type as type,
          cost_center_client as client
        FROM multidimensional_costs_view
        WHERE cost_center_id = ?
      `, [costCenterId]);

      if (centerInfo.length === 0) {
        return null;
      }

      // Distribución por categorías en este centro
      const [categoryBreakdown] = await pool.query(`
        SELECT 
          category_group,
          category_name,
          transaction_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM multidimensional_costs_view
        WHERE cost_center_id = ?
        GROUP BY category_group, category_name, transaction_type
        ORDER BY total_amount DESC
      `, [costCenterId]);

      // Evolución temporal
      const [timeEvolution] = await pool.query(`
        SELECT 
          period_year,
          period_month,
          period_key,
          transaction_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        WHERE cost_center_id = ?
        GROUP BY period_year, period_month, period_key, transaction_type
        ORDER BY period_year, period_month
      `, [costCenterId]);

      // Top empleados en este centro
      const [topEmployees] = await pool.query(`
        SELECT 
          employee_name,
          employee_position,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        WHERE cost_center_id = ? AND employee_id IS NOT NULL
        GROUP BY employee_name, employee_position
        ORDER BY total_amount DESC
        LIMIT 10
      `, [costCenterId]);

      return {
        cost_center: centerInfo[0],
        category_breakdown: categoryBreakdown,
        time_evolution: timeEvolution,
        top_employees: topEmployees
      };

    } catch (error) {
      console.error('Error in drillDownCostCenter model:', error);
      throw error;
    }
  },

  // ==========================================
  // RESÚMENES EJECUTIVOS
  // ==========================================

  /**
   * Obtiene resumen ejecutivo multidimensional
   * @returns {Promise<Object>} - Resumen ejecutivo completo
   */
  async getExecutiveSummary() {
    try {
      // Resumen por tipo de transacción
      const [transactionSummary] = await pool.query(`
        SELECT 
          transaction_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM multidimensional_costs_view
        GROUP BY transaction_type
      `);

      // Top 10 centros de costo por gasto
      const [topCostCenters] = await pool.query(`
        SELECT 
          cost_center_name,
          cost_center_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        WHERE transaction_type = 'gasto'
        GROUP BY cost_center_name, cost_center_type
        ORDER BY total_amount DESC
        LIMIT 10
      `);

      // Evolución mensual últimos 12 meses
      const [monthlyEvolution] = await pool.query(`
        SELECT 
          period_key,
          transaction_type,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY period_key, transaction_type
        ORDER BY period_key
      `);

      // Distribución por categorías principales
      const [categoryDistribution] = await pool.query(`
        SELECT 
          category_group,
          transaction_type,
          COUNT(*) as cost_count,
          SUM(amount) as total_amount
        FROM multidimensional_costs_view
        GROUP BY category_group, transaction_type
        ORDER BY total_amount DESC
      `);

      return {
        transaction_summary: transactionSummary,
        top_cost_centers: topCostCenters,
        monthly_evolution: monthlyEvolution,
        category_distribution: categoryDistribution
      };

    } catch (error) {
      console.error('Error in getExecutiveSummary model:', error);
      throw error;
    }
  },

  // ==========================================
  // ESTADÍSTICAS RÁPIDAS
  // ==========================================

  /**
   * Obtiene estadísticas rápidas para dashboard
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Object>} - Estadísticas del período
   */
  async getQuickStats(filters = {}) {
    try {
      let whereClause = '1=1';
      let queryParams = [];

      // Aplicar filtros si existen
      if (filters.period_year) {
        whereClause += ' AND period_year = ?';
        queryParams.push(filters.period_year);
      }

      if (filters.period_month) {
        whereClause += ' AND period_month = ?';
        queryParams.push(filters.period_month);
      }

      if (filters.cost_center_type) {
        whereClause += ' AND cost_center_type = ?';
        queryParams.push(filters.cost_center_type);
      }

      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT cost_center_id) as unique_cost_centers,
          COUNT(DISTINCT employee_id) as unique_employees,
          COUNT(DISTINCT supplier_id) as unique_suppliers,
          SUM(CASE WHEN transaction_type = 'gasto' THEN amount ELSE 0 END) as total_expenses,
          SUM(CASE WHEN transaction_type = 'ingreso' THEN amount ELSE 0 END) as total_income,
          AVG(amount) as avg_transaction,
          MAX(amount) as max_transaction,
          MIN(amount) as min_transaction
        FROM multidimensional_costs_view
        WHERE ${whereClause}
      `, queryParams);

      return stats[0];

    } catch (error) {
      console.error('Error in getQuickStats model:', error);
      throw error;
    }
  }
};