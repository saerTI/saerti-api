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

    // Filtro por año si se proporciona
    if (req.query.year) {
      whereConditions.push('period_year = ?');
      queryParams.push(parseInt(req.query.year));
      filters.year = parseInt(req.query.year);
    }

    // Filtro por tipo de transacción (por defecto gastos)
    const transactionType = req.query.transaction_type || 'gasto';
    whereConditions.push('transaction_type = ?');
    queryParams.push(transactionType);
    filters.transaction_type = transactionType;

    // Filtros opcionales
    if (req.query.cost_center_id && !isNaN(parseInt(req.query.cost_center_id))) {
      whereConditions.push('cost_center_id = ?');
      queryParams.push(parseInt(req.query.cost_center_id));
      filters.cost_center_id = parseInt(req.query.cost_center_id);
    }

    if (req.query.category_id && !isNaN(parseInt(req.query.category_id))) {
      whereConditions.push('category_id = ?');
      queryParams.push(parseInt(req.query.category_id));
      filters.category_id = parseInt(req.query.category_id);
    }

    if (req.query.status && req.query.status !== 'all') {
      whereConditions.push('status = ?');
      queryParams.push(req.query.status);
      filters.status = req.query.status;
    }

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    console.log('📊 Processed filters:', filters);
    console.log('📊 Pagination:', { page, limit });

    // Construir la cláusula WHERE
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // ✅ VERIFICAR QUE LA VISTA EXISTE
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

    // ✅ 1. OBTENER RESUMEN
    console.log('📊 Getting summary data...');
    const [summaryRows] = await pool.query(`
      SELECT 
        SUM(CASE WHEN transaction_type = 'ingreso' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN transaction_type = 'gasto' THEN amount ELSE 0 END) as total_expenses,
        COUNT(CASE WHEN status IN ('pendiente', 'borrador') THEN 1 END) as pending_count,
        COUNT(CASE WHEN status IN ('aprobado', 'pagado') THEN 1 END) as approved_count,
        COUNT(*) as total_count
      FROM multidimensional_costs_view
      ${whereClause}
    `, queryParams);

    const summary = summaryRows[0] || {
      total_income: 0,
      total_expenses: 0,
      pending_count: 0,
      approved_count: 0,
      total_count: 0
    };

    console.log('📊 Summary calculated:', summary);

    // ✅ 2. OBTENER ITEMS DETALLADOS
    console.log('📊 Getting detailed items...');
    const [items] = await pool.query(`
      SELECT 
        cost_id,
        transaction_type,
        cost_type,
        amount,
        description,
        date,
        period_year,
        period_month,
        status,
        cost_center_name,
        category_name,
        category_group,
        supplier_name,
        employee_name,
        source_type,
        period_key,
        created_at,
        updated_at
      FROM multidimensional_costs_view
      ${whereClause}
      ORDER BY date DESC, created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    console.log(`📊 Found ${items.length} items`);

    // ✅ 3. OBTENER DATOS POR CATEGORÍA - INCLUYENDO VACÍAS
    console.log('📊 Getting category data (including empty categories)...');
    
    // Primero obtener TODAS las categorías disponibles
    const [allCategories] = await pool.query(`
      SELECT DISTINCT 
        id,
        name,
        group_name,
        code
      FROM account_categories 
      WHERE active = 1
      ORDER BY group_name, name
    `);

    // Luego obtener las que SÍ tienen datos
    const [categoriesWithData] = await pool.query(`
      SELECT 
        category_id,
        COALESCE(category_name, 'Sin Categoría') as category_name,
        COALESCE(category_group, 'Sin Grupo') as category_group,
        COUNT(*) as cost_count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      ${whereClause}
      GROUP BY category_id, category_name, category_group
      ORDER BY total_amount DESC
    `, queryParams);

    // Crear mapa de categorías con datos
    const dataMap = new Map();
    categoriesWithData.forEach(cat => {
      dataMap.set(cat.category_id, {
        category_name: cat.category_name,
        category_group: cat.category_group,
        cost_count: parseInt(cat.cost_count) || 0,
        total_amount: parseFloat(cat.total_amount) || 0
      });
    });

    // Combinar todas las categorías con sus datos (0 si no tienen)
    const categoryData = allCategories.map(cat => {
      const hasData = dataMap.get(cat.id);
      return {
        category_id: cat.id,
        category_name: cat.name,
        category_group: cat.group_name || 'Sin Grupo',
        category_code: cat.code,
        cost_count: hasData ? hasData.cost_count : 0,
        total_amount: hasData ? hasData.total_amount : 0,
        has_data: !!hasData
      };
    });

    console.log(`📊 Found ${categoryData.length} total categories (${categoriesWithData.length} with data, ${categoryData.length - categoriesWithData.length} empty)`);

    // Separar categorías con datos y vacías
    const categoriesWithValues = categoryData.filter(cat => cat.has_data).slice(0, 20); // Top 20 con datos
    const emptyCategories = categoryData.filter(cat => !cat.has_data);

    // ✅ 4. CALCULAR TOTALES PARA PAGINACIÓN
    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS total FROM multidimensional_costs_view ${whereClause}`,
      queryParams
    );

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // ✅ 5. RESPUESTA CON ESTRUCTURA ESPERADA POR EL FRONTEND
    res.json({
      success: true,
      data: {
        // Estructura esperada por getCostsData()
        summary: {
          total_expenses: parseFloat(summary.total_expenses) || 0,
          total_income: parseFloat(summary.total_income) || 0,
          pending_count: parseInt(summary.pending_count) || 0,
          approved_count: parseInt(summary.approved_count) || 0,
          total_count: parseInt(summary.total_count) || 0
        },
        items: items.map(item => ({
          cost_id: item.cost_id,
          transaction_type: item.transaction_type,
          description: item.description,
          amount: parseFloat(item.amount) || 0,
          date: item.date,
          period_year: item.period_year,
          period_month: item.period_month,
          status: item.status,
          cost_center_name: item.cost_center_name,
          category_name: item.category_name,
          supplier_name: item.supplier_name,
          employee_name: item.employee_name,
          source_type: item.source_type,
          period_key: item.period_key
        })),
        by_category: categoriesWithValues.map(cat => ({
          category_id: cat.category_id,
          category_name: cat.category_name,
          category_group: cat.category_group,
          category_code: cat.category_code,
          cost_count: cat.cost_count,
          total_amount: cat.total_amount,
          has_data: cat.has_data
        })),
        empty_categories: emptyCategories.map(cat => ({
          category_id: cat.category_id,
          category_name: cat.category_name,
          category_group: cat.category_group,
          category_code: cat.category_code,
          cost_count: 0,
          total_amount: 0,
          has_data: false
        }))
      },
      category_summary: {
        total_categories: categoryData.length,
        categories_with_data: categoriesWithValues.length,
        empty_categories_count: emptyCategories.length
      },
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

    console.log('✅ Response sent successfully');

  } catch (error) {
    console.error('❌ Error in exploreCosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al explorar costos',
      error: error.message,
      suggestion: 'Verificar que la vista multidimensional_costs_view existe y tiene datos'
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
    const contextParams = [];
    let contextWhere = '';

    if (req.query.transaction_type) {
      const validTypes = ['ingreso', 'gasto'];
      if (validTypes.includes(req.query.transaction_type)) {
        contextWhere = 'WHERE transaction_type = ?';
        contextParams.push(req.query.transaction_type);
      }
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
    console.log('📊 Getting cost centers...');
    const [costCenters] = await pool.query(`
      SELECT DISTINCT 
        cost_center_id as id,
        cost_center_name as name,
        cost_center_type as type,
        COUNT(*) as cost_count
      FROM multidimensional_costs_view
      ${contextWhere}
      GROUP BY cost_center_id, cost_center_name, cost_center_type
      HAVING cost_center_id IS NOT NULL
      ORDER BY cost_center_name
    `, contextParams);

    // ✅ CATEGORÍAS CONTABLES
    console.log('📊 Getting categories...');
    const [categories] = await pool.query(`
      SELECT DISTINCT 
        category_id as id,
        category_name as name,
        category_group as group_name,
        COUNT(*) as cost_count
      FROM multidimensional_costs_view
      ${contextWhere}
      GROUP BY category_id, category_name, category_group
      HAVING category_id IS NOT NULL
      ORDER BY category_name
    `, contextParams);

    // ✅ ESTADOS DISPONIBLES
    console.log('📊 Getting statuses...');
    const [statusRows] = await pool.query(`
      SELECT DISTINCT 
        status as value,
        CASE 
          WHEN status = 'pendiente' THEN 'Pendiente'
          WHEN status = 'aprobado' THEN 'Aprobado'
          WHEN status = 'pagado' THEN 'Pagado'
          WHEN status = 'borrador' THEN 'Borrador'
          WHEN status = 'rechazado' THEN 'Rechazado'
          WHEN status = 'cancelado' THEN 'Cancelado'
          ELSE CONCAT(UPPER(SUBSTRING(status, 1, 1)), LOWER(SUBSTRING(status, 2)))
        END as label,
        COUNT(*) as cost_count
      FROM multidimensional_costs_view
      ${contextWhere}
      GROUP BY status
      HAVING status IS NOT NULL
      ORDER BY status
    `, contextParams);

    console.log(`📊 Found ${costCenters.length} cost centers, ${categories.length} categories, ${statusRows.length} statuses`);

    // ✅ RESPUESTA CON ESTRUCTURA ESPERADA POR EL FRONTEND
    res.json({
      success: true,
      data: {
        // Estructura esperada por getFilterOptions()
        cost_centers: costCenters.map(cc => ({
          id: cc.id,
          name: cc.name,
          type: cc.type
        })),
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          group_name: cat.group_name
        })),
        statuses: statusRows.map(status => ({
          value: status.value,
          label: status.label
        }))
      },
      metadata: {
        cost_centers_count: costCenters.length,
        categories_count: categories.length,
        statuses_count: statusRows.length,
        generated_at: new Date().toISOString()
      }
    });

    console.log('✅ Dimensions response sent successfully');

  } catch (error) {
    console.error('❌ Error in getCostsDimensions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dimensiones',
      error: error.message,
      suggestion: 'Verificar que la vista multidimensional_costs_view existe y tiene datos'
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

/**
 * GET /api/costs/by-period
 * Obtener datos de costos agrupados por categoría y período para tabla financiera
 */
export const getCostsByPeriod = async (req, res) => {
  try {
    console.log('📊 Getting costs by period with filters:', req.query);
    
    // ✅ PROCESAR FILTROS
    const {
      period_type = 'monthly',
      year = new Date().getFullYear().toString(),
      cost_center_id,
      category_id,
      status,
      transaction_type = 'gasto' // Por defecto solo gastos
    } = req.query;

    // Construir filtros dinámicamente
    let whereConditions = [];
    let queryParams = [];

    // Filtro por año (obligatorio)
    whereConditions.push('period_year = ?');
    queryParams.push(parseInt(year));

    // Filtro por tipo de transacción
    whereConditions.push('transaction_type = ?');
    queryParams.push(transaction_type);

    // Filtros opcionales
    if (cost_center_id && cost_center_id !== 'all') {
      whereConditions.push('cost_center_id = ?');
      queryParams.push(parseInt(cost_center_id));
    }

    if (category_id && category_id !== 'all') {
      whereConditions.push('category_id = ?');
      queryParams.push(parseInt(category_id));
    }

    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // ✅ DETERMINAR AGRUPACIÓN POR PERÍODO
    let periodSelect = '';
    let periodGroupBy = '';
    
    switch (period_type) {
      case 'weekly':
        // Agrupar por semana del año
        periodSelect = `CONCAT(period_year, '-W', LPAD(WEEK(date, 1), 2, '0')) as period_key`;
        periodGroupBy = 'period_year, WEEK(date, 1)';
        break;
        
      case 'quarterly':
        // Agrupar por trimestre
        periodSelect = `CONCAT(period_year, '-Q', QUARTER(date)) as period_key`;
        periodGroupBy = 'period_year, QUARTER(date)';
        break;
        
      case 'annual':
        // Agrupar por año
        periodSelect = `period_year as period_key`;
        periodGroupBy = 'period_year';
        break;
        
      default: // monthly
        // Agrupar por mes (por defecto)
        periodSelect = `CONCAT(period_year, '-', LPAD(period_month, 2, '0')) as period_key`;
        periodGroupBy = 'period_year, period_month';
    }

    // ✅ VERIFICAR QUE LA VISTA EXISTE
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

    // ✅ CONSULTA PRINCIPAL: AGRUPAR POR CATEGORÍA Y PERÍODO
    const [results] = await pool.query(`
      SELECT 
        COALESCE(category_name, 'Sin Categoría') as category_name,
        ${periodSelect},
        SUM(amount) as total_amount,
        COUNT(*) as cost_count,
        -- Campos adicionales para debugging
        GROUP_CONCAT(DISTINCT source_type) as source_types,
        MIN(date) as min_date,
        MAX(date) as max_date
      FROM multidimensional_costs_view
      ${whereClause}
      GROUP BY category_name, ${periodGroupBy}
      HAVING total_amount > 0  -- Solo incluir categorías con montos > 0
      ORDER BY total_amount DESC, category_name, ${periodGroupBy}
    `, queryParams);

    console.log(`📊 Found ${results.length} category-period combinations with data`);
    
    // Log algunos ejemplos para debugging
    if (results.length > 0) {
      console.log('📊 Sample results:', results.slice(0, 3).map(r => ({
        category: r.category_name,
        period: r.period_key,
        amount: r.total_amount,
        source_types: r.source_types
      })));
    }

    // ✅ TRANSFORMAR DATOS AL FORMATO ESPERADO POR EL FRONTEND
    const formattedResults = results.map(row => ({
      category_name: row.category_name,
      period_key: row.period_key.toString(),
      total_amount: parseFloat(row.total_amount) || 0,
      cost_count: parseInt(row.cost_count) || 0
    }));

    // ✅ ESTADÍSTICAS ADICIONALES
    const totalAmount = formattedResults.reduce((sum, item) => sum + item.total_amount, 0);
    const uniqueCategories = [...new Set(formattedResults.map(item => item.category_name))].length;
    const uniquePeriods = [...new Set(formattedResults.map(item => item.period_key))].length;

    // ✅ RESPUESTA EXITOSA
    res.json({
      success: true,
      data: formattedResults,
      metadata: {
        total_amount: totalAmount,
        unique_categories: uniqueCategories,
        unique_periods: uniquePeriods,
        period_type,
        year: parseInt(year),
        filters_applied: Object.keys(req.query).length,
        query_time: new Date().toISOString()
      },
      applied_filters: {
        period_type,
        year,
        cost_center_id: cost_center_id || 'all',
        category_id: category_id || 'all',  
        status: status || 'all',
        transaction_type
      }
    });

  } catch (error) {
    console.error('❌ Error in getCostsByPeriod:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener costos por período',
      error: error.message,
      suggestion: 'Verificar que la vista multidimensional_costs_view existe y tiene datos'
    });
  }
};

/**
 * GET /api/costs/debug
 * Debug: Verificar qué datos hay en cada tabla
 */
export const debugCostsData = async (req, res) => {
  try {
    console.log('🔍 Debugging costs data sources...');

    // 1. Verificar accounting_costs
    const [accountingCosts] = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        MIN(date) as min_date,
        MAX(date) as max_date,
        SUM(amount) as total_amount,
        GROUP_CONCAT(DISTINCT transaction_type) as transaction_types,
        GROUP_CONCAT(DISTINCT YEAR(date)) as years
      FROM accounting_costs
    `);

    // 2. Verificar purchase_orders  
    const [purchaseOrders] = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        MIN(po_date) as min_date,
        MAX(po_date) as max_date,
        SUM(total) as total_amount,
        GROUP_CONCAT(DISTINCT status) as statuses,
        GROUP_CONCAT(DISTINCT YEAR(po_date)) as years
      FROM purchase_orders
    `);

    // 3. Verificar fixed_costs (si existe)
    let fixedCosts = [{ total_count: 0, message: 'Table does not exist' }];
    try {
      const [fixed] = await pool.query(`
        SELECT 
          COUNT(*) as total_count,
          MIN(start_date) as min_date,
          MAX(end_date) as max_date,
          SUM(quota_value * quota_count) as total_amount
        FROM fixed_costs
      `);
      fixedCosts = fixed;
    } catch (error) {
      fixedCosts = [{ total_count: 0, message: 'Table does not exist or error: ' + error.message }];
    }

    // 4. Verificar la vista multidimensional
    const [viewData] = await pool.query(`
      SELECT 
        source_type,
        COUNT(*) as count,
        MIN(date) as min_date,
        MAX(date) as max_date,
        SUM(amount) as total_amount,
        GROUP_CONCAT(DISTINCT transaction_type) as transaction_types
      FROM multidimensional_costs_view
      GROUP BY source_type
      ORDER BY count DESC
    `);

    // 5. Verificar datos por años en la vista
    const [yearData] = await pool.query(`
      SELECT 
        period_year,
        period_month,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      WHERE period_year IN (2024, 2025)
      GROUP BY period_year, period_month
      ORDER BY period_year DESC, period_month DESC
      LIMIT 20
    `);

    // 6. Verificar categorías en la vista
    const [categoryData] = await pool.query(`
      SELECT 
        category_name,
        source_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM multidimensional_costs_view
      GROUP BY category_name, source_type
      ORDER BY total_amount DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      debug_data: {
        accounting_costs: accountingCosts[0],
        purchase_orders: purchaseOrders[0],
        fixed_costs: fixedCosts[0],
        multidimensional_view_by_source: viewData,
        recent_periods: yearData,
        top_categories: categoryData
      },
      analysis: {
        total_sources: viewData.length,
        has_accounting_data: accountingCosts[0].total_count > 0,
        has_purchase_orders: purchaseOrders[0].total_count > 0,
        has_fixed_costs: fixedCosts[0].total_count > 0,
        view_total_records: viewData.reduce((sum, item) => sum + item.count, 0)
      },
      recommendations: generateRecommendations(accountingCosts[0], purchaseOrders[0], fixedCosts[0], viewData)
    });

  } catch (error) {
    console.error('❌ Error in debugCostsData:', error);
    res.status(500).json({
      success: false,
      message: 'Error en debug de datos',
      error: error.message
    });
  }
};

// Función auxiliar para generar recomendaciones
function generateRecommendations(accounting, purchases, fixed, viewData) {
  const recommendations = [];
  
  if (accounting.total_count === 0) {
    recommendations.push('⚠️ La tabla accounting_costs está vacía. Necesitas cargar datos de remuneraciones y costos manuales.');
  }
  
  if (purchases.total_count === 0) {
    recommendations.push('⚠️ La tabla purchase_orders está vacía. Necesitas cargar órdenes de compra.');
  }
  
  if (fixed.total_count === 0) {
    recommendations.push('⚠️ La tabla fixed_costs está vacía o no existe. Costos fijos no aparecerán.');
  }
  
  if (viewData.length === 1 && viewData[0].source_type === 'orden_compra') {
    recommendations.push('🎯 Solo aparecen datos de órdenes de compra. Verifica que accounting_costs tenga datos.');
  }
  
  if (viewData.length === 0) {
    recommendations.push('❌ La vista multidimensional no tiene datos. Verifica las tablas base.');
  }
  
  return recommendations;
}