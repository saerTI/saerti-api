// src/controllers/CC/multidimensionalController.mjs
import { pool } from '../../config/database.mjs';

// ==========================================
// CONTROLADOR PRINCIPAL: NAVEGACIÓN MULTIDIMENSIONAL
// ==========================================

/**
 * GET /api/costs/explore
 * Navegación multidimensional con filtros tipo ecommerce
 */
export const exploreCosts = async (req, res) => {
  try {
    console.log('🔍 Exploring costs with filters:', req.query);

    // ✅ VALIDAR Y LIMPIAR FILTROS
    const filters = {};
    const queryParams = [];
    let whereConditions = [];

    // Filtros de dimensiones principales
    if (req.query.transaction_type) {
      const validTypes = ['ingreso', 'gasto'];
      if (validTypes.includes(req.query.transaction_type)) {
        whereConditions.push('transaction_type = ?');
        queryParams.push(req.query.transaction_type);
        filters.transaction_type = req.query.transaction_type;
      }
    }

    if (req.query.cost_center_id && !isNaN(parseInt(req.query.cost_center_id))) {
      whereConditions.push('cost_center_id = ?');
      queryParams.push(parseInt(req.query.cost_center_id));
      filters.cost_center_id = parseInt(req.query.cost_center_id);
    }

    if (req.query.cost_center_type) {
      whereConditions.push('cost_center_type = ?');
      queryParams.push(req.query.cost_center_type.trim());
      filters.cost_center_type = req.query.cost_center_type.trim();
    }

    if (req.query.category_id && !isNaN(parseInt(req.query.category_id))) {
      whereConditions.push('category_id = ?');
      queryParams.push(parseInt(req.query.category_id));
      filters.category_id = parseInt(req.query.category_id);
    }

    if (req.query.category_group) {
      whereConditions.push('category_group = ?');
      queryParams.push(req.query.category_group.trim());
      filters.category_group = req.query.category_group.trim();
    }

    if (req.query.employee_id && !isNaN(parseInt(req.query.employee_id))) {
      whereConditions.push('employee_id = ?');
      queryParams.push(parseInt(req.query.employee_id));
      filters.employee_id = parseInt(req.query.employee_id);
    }

    if (req.query.supplier_id && !isNaN(parseInt(req.query.supplier_id))) {
      whereConditions.push('supplier_id = ?');
      queryParams.push(parseInt(req.query.supplier_id));
      filters.supplier_id = parseInt(req.query.supplier_id);
    }

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    console.log('📊 Processed filters:', filters);
    console.log('📊 Pagination:', { page, limit });

    // Construir la cláusula WHERE
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // ✅ VERIFICAR SI LA VISTA EXISTE
    try {
      await pool.query('SELECT 1 FROM multidimensional_costs_view LIMIT 1');
    } catch (viewError) {
      console.error('❌ Vista multidimensional no existe:', viewError.message);
      return res.status(500).json({
        success: false,
        message: 'Vista multidimensional no configurada',
        error: 'La vista multidimensional_costs_view no existe en la base de datos',
        suggestion: 'Ejecutar el script de setup para crear la vista'
      });
    }

    // ✅ OBTENER DATOS
    const [rows] = await pool.query(
      `SELECT 
        cost_id,
        description,
        amount,
        date,
        transaction_type,
        cost_center_id,
        cost_center_code,
        cost_center_name,
        cost_center_type,
        category_id,
        category_name,
        category_group,
        employee_id,
        employee_name,
        employee_position,
        employee_department,
        supplier_id,
        supplier_name,
        supplier_tax_id,
        period_year,
        period_month,
        period_key,
        source_type,
        source_id,
        created_at,
        updated_at
      FROM multidimensional_costs_view 
      ${whereClause} 
      ORDER BY date DESC, cost_id DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // ✅ OBTENER TOTAL PARA PAGINACIÓN
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM multidimensional_costs_view ${whereClause}`,
      queryParams
    );

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // ✅ RESPUESTA EXITOSA
    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      applied_filters: filters,
      metadata: {
        total_results: total,
        filters_applied: Object.keys(filters).length,
        query_time: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in exploreCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al explorar costos',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/dimensions
 * Obtiene todas las dimensiones disponibles para filtros dinámicos
 */
export const getCostsDimensions = async (req, res) => {
  try {
    console.log('🔍 Getting dimensions with base filters:', req.query);

    // ✅ VALIDAR FILTROS BASE PARA CONTEXTO
    const baseFilters = {};
    const contextParams = [];
    let contextWhere = '';

    if (req.query.transaction_type) {
      const validTypes = ['ingreso', 'gasto'];
      if (validTypes.includes(req.query.transaction_type)) {
        baseFilters.transaction_type = req.query.transaction_type;
        contextWhere = 'WHERE transaction_type = ?';
        contextParams.push(req.query.transaction_type);
      }
    }

    if (req.query.cost_center_type) {
      baseFilters.cost_center_type = req.query.cost_center_type.trim();
      contextWhere = contextWhere ? 
        `${contextWhere} AND cost_center_type = ?` : 
        'WHERE cost_center_type = ?';
      contextParams.push(req.query.cost_center_type.trim());
    }

    if (req.query.cost_center_id && !isNaN(parseInt(req.query.cost_center_id))) {
      baseFilters.cost_center_id = parseInt(req.query.cost_center_id);
      contextWhere = contextWhere ? 
        `${contextWhere} AND cost_center_id = ?` : 
        'WHERE cost_center_id = ?';
      contextParams.push(parseInt(req.query.cost_center_id));
    }

    // ✅ VERIFICAR SI LA VISTA EXISTE
    try {
      await pool.query('SELECT 1 FROM multidimensional_costs_view LIMIT 1');
    } catch (viewError) {
      console.error('❌ Vista multidimensional no existe:', viewError.message);
      return res.status(500).json({
        success: false,
        message: 'Vista multidimensional no configurada',
        error: 'La vista multidimensional_costs_view no existe en la base de datos',
        suggestion: 'Ejecutar el script de setup para crear la vista'
      });
    }

    // ✅ CENTROS DE COSTO
    const [costCenters] = await pool.query(`
      SELECT DISTINCT 
        cost_center_id as id,
        cost_center_code as code,
        cost_center_name as name,
        cost_center_type as type,
        COUNT(*) as cost_count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      ${contextWhere}
      GROUP BY cost_center_id, cost_center_code, cost_center_name, cost_center_type
      ORDER BY cost_count DESC
    `, contextParams);

    // ✅ CATEGORÍAS CONTABLES
    const [categories] = await pool.query(`
      SELECT DISTINCT 
        category_id as id,
        category_name as name,
        category_group,
        COUNT(*) as cost_count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      ${contextWhere}
      GROUP BY category_id, category_name, category_group
      ORDER BY cost_count DESC
    `, contextParams);

    // ✅ EMPLEADOS
    const [employees] = await pool.query(`
      SELECT DISTINCT 
        employee_id as id,
        employee_name as name,
        employee_position,
        employee_department,
        COUNT(*) as cost_count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      ${contextWhere ? `${contextWhere} AND` : 'WHERE'} employee_id IS NOT NULL
      GROUP BY employee_id, employee_name, employee_position, employee_department
      ORDER BY cost_count DESC
    `, contextParams);

    // ✅ PROVEEDORES
    const [suppliers] = await pool.query(`
      SELECT DISTINCT 
        supplier_id as id,
        supplier_name as name,
        supplier_tax_id,
        COUNT(*) as cost_count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      ${contextWhere ? `${contextWhere} AND` : 'WHERE'} supplier_id IS NOT NULL
      GROUP BY supplier_id, supplier_name, supplier_tax_id
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

    // ✅ TIPOS DE FUENTE
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

    const dimensions = {
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

    // ✅ RESPUESTA EXITOSA
    res.json({
      success: true,
      data: dimensions,
      applied_filters: baseFilters,
      metadata: {
        cost_centers_count: dimensions.cost_centers.length,
        categories_count: dimensions.categories.length,
        employees_count: dimensions.employees.length,
        suppliers_count: dimensions.suppliers.length,
        periods_count: dimensions.periods.length,
        source_types_count: dimensions.source_types.length,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in getDimensions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dimensiones',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/drill-down/cost-center/:id
 * Análisis detallado de un centro de costo específico
 */
export const drillDownCostCenter = async (req, res) => {
  try {
    const costCenterId = parseInt(req.params.id);
    
    if (isNaN(costCenterId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de centro de costo inválido'
      });
    }

    // Crear filtros específicos para este centro de costo
    const tempReq = {
      ...req,
      query: {
        cost_center_id: costCenterId,
        limit: 100
      }
    };

    // Reutilizar la función exploreCosts
    return exploreCosts(tempReq, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en drill-down del centro de costo',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/drill-down/category/:id
 * Análisis detallado de una categoría específica
 */
export const drillDownCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    // Crear filtros específicos para esta categoría
    const tempReq = {
      ...req,
      query: {
        category_id: categoryId,
        limit: 100
      }
    };

    // Reutilizar la función exploreCosts
    return exploreCosts(tempReq, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en drill-down de la categoría',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/executive-summary
 * Resumen ejecutivo multidimensional (simplificado)
 */
export const getExecutiveSummary = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        message: 'Resumen ejecutivo en desarrollo',
        available_endpoints: ['/explore', '/dimensions', '/health']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en resumen ejecutivo',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/quick-stats
 * Estadísticas rápidas para dashboard (simplificado)
 */
export const getQuickStats = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        message: 'Estadísticas rápidas en desarrollo',
        available_endpoints: ['/explore', '/dimensions', '/health']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en estadísticas rápidas',
      error: error.message
    });
  }
};

/**
 * GET /api/costs/health
 * Verificar salud del sistema multidimensional
 */
export const getHealthCheck = async (req, res) => {
  try {
    // Verificar que la vista multidimensional existe
    await pool.query('SELECT 1 FROM multidimensional_costs_view LIMIT 1');
    
    res.json({
      success: true,
      message: 'Sistema multidimensional funcionando correctamente',
      timestamp: new Date().toISOString(),
      components: {
        database_view: 'OK',
        routes: 'OK',
        controller: 'OK',
        model: 'OK'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en sistema multidimensional',
      error: error.message,
      suggestion: 'Verificar que la vista multidimensional_costs_view existe en la base de datos'
    });
  }
};