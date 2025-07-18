// src/controllers/CC/multidimensionalController.mjs

import multidimensionalModel from "../../models/CC/multidimensionalModel.mjs";

/**
 * Controlador para navegación multidimensional de costos
 * Funciona como un ecommerce: filtrar por múltiples dimensiones
 */
export default {

  // ==========================================
  // ENDPOINT PRINCIPAL: NAVEGACIÓN MULTIDIMENSIONAL
  // ==========================================

  /**
   * GET /api/costs/explore
   * Navegación multidimensional con filtros tipo ecommerce
   */
  async exploreCosts(req, res, next) {
    try {
      console.log('🔍 Exploring costs with filters:', req.query);

      // ✅ VALIDAR Y LIMPIAR FILTROS
      const filters = {};

      // Filtros de dimensiones principales
      if (req.query.transaction_type) {
        const validTypes = ['ingreso', 'gasto'];
        if (validTypes.includes(req.query.transaction_type)) {
          filters.transaction_type = req.query.transaction_type;
        }
      }

      if (req.query.cost_center_id && !isNaN(parseInt(req.query.cost_center_id))) {
        filters.cost_center_id = parseInt(req.query.cost_center_id);
      }

      if (req.query.cost_center_type) {
        filters.cost_center_type = req.query.cost_center_type.trim();
      }

      if (req.query.category_id && !isNaN(parseInt(req.query.category_id))) {
        filters.category_id = parseInt(req.query.category_id);
      }

      if (req.query.category_group) {
        filters.category_group = req.query.category_group.trim();
      }

      if (req.query.employee_id && !isNaN(parseInt(req.query.employee_id))) {
        filters.employee_id = parseInt(req.query.employee_id);
      }

      if (req.query.employee_department) {
        filters.employee_department = req.query.employee_department.trim();
      }

      if (req.query.supplier_id && !isNaN(parseInt(req.query.supplier_id))) {
        filters.supplier_id = parseInt(req.query.supplier_id);
      }

      // Filtros de período
      if (req.query.period_year && !isNaN(parseInt(req.query.period_year))) {
        filters.period_year = parseInt(req.query.period_year);
      }

      if (req.query.period_month && !isNaN(parseInt(req.query.period_month))) {
        const month = parseInt(req.query.period_month);
        if (month >= 1 && month <= 12) {
          filters.period_month = month;
        }
      }

      // Filtros de fuente
      if (req.query.source_type) {
        const validSources = ['orden_compra', 'nomina', 'seguridad_social', 'factura', 'manual'];
        if (validSources.includes(req.query.source_type)) {
          filters.source_type = req.query.source_type;
        }
      }

      // Filtros de rango de montos
      if (req.query.amount_min && !isNaN(parseFloat(req.query.amount_min))) {
        filters.amount_min = parseFloat(req.query.amount_min);
      }

      if (req.query.amount_max && !isNaN(parseFloat(req.query.amount_max))) {
        filters.amount_max = parseFloat(req.query.amount_max);
      }

      // Filtros de fechas
      if (req.query.date_from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_from)) {
        filters.date_from = req.query.date_from;
      }

      if (req.query.date_to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_to)) {
        filters.date_to = req.query.date_to;
      }

      // Búsqueda de texto
      if (req.query.search && req.query.search.trim()) {
        filters.search = req.query.search.trim();
      }

      // Ordenamiento
      if (req.query.sort) {
        const validSorts = [
          'date_desc', 'date_asc', 'amount_desc', 'amount_asc', 
          'description', 'cost_center', 'category'
        ];
        if (validSorts.includes(req.query.sort)) {
          filters.sort = req.query.sort;
        }
      }

      // ✅ CONFIGURAR PAGINACIÓN
      const pagination = {
        page: Math.max(parseInt(req.query.page) || 1, 1),
        limit: Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100) // Max 100 por página
      };

      console.log('📊 Processed filters:', filters);
      console.log('📊 Pagination:', pagination);

      // ✅ OBTENER DATOS DEL MODELO
      const result = await multidimensionalModel.exploreCosts(filters, pagination);

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        applied_filters: filters,
        metadata: {
          total_results: result.pagination.total,
          filters_applied: Object.keys(filters).length,
          query_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in exploreCosts controller:', error);
      next(error);
    }
  },

  // ==========================================
  // ENDPOINTS DE DIMENSIONES (para construir filtros dinámicos)
  // ==========================================

  /**
   * GET /api/costs/dimensions
   * Obtiene todas las dimensiones disponibles para filtros
   */
  async getDimensions(req, res, next) {
    try {
      console.log('🔍 Getting dimensions with base filters:', req.query);

      // ✅ VALIDAR FILTROS BASE PARA CONTEXTO
      const baseFilters = {};

      if (req.query.transaction_type) {
        const validTypes = ['ingreso', 'gasto'];
        if (validTypes.includes(req.query.transaction_type)) {
          baseFilters.transaction_type = req.query.transaction_type;
        }
      }

      if (req.query.cost_center_type) {
        baseFilters.cost_center_type = req.query.cost_center_type.trim();
      }

      // ✅ OBTENER DIMENSIONES DEL MODELO
      const dimensions = await multidimensionalModel.getDimensions(baseFilters);

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
      console.error('❌ Error in getDimensions controller:', error);
      next(error);
    }
  },

  // ==========================================
  // DRILL-DOWN ESPECÍFICOS
  // ==========================================

  /**
   * GET /api/costs/drill-down/cost-center/:id
   * Drill-down específico por centro de costo
   */
  async drillDownCostCenter(req, res, next) {
    try {
      const { id } = req.params;

      // ✅ VALIDAR ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de centro de costo inválido'
        });
      }

      const costCenterId = parseInt(id);
      console.log(`🔍 Drill-down for cost center ID: ${costCenterId}`);

      // ✅ OBTENER ANÁLISIS DEL MODELO
      const analysis = await multidimensionalModel.drillDownCostCenter(costCenterId);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Centro de costo no encontrado o sin datos'
        });
      }

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: analysis,
        metadata: {
          cost_center_id: costCenterId,
          categories_analyzed: analysis.category_breakdown.length,
          time_periods: analysis.time_evolution.length,
          top_employees: analysis.top_employees.length,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in drillDownCostCenter controller:', error);
      next(error);
    }
  },

  /**
   * GET /api/costs/drill-down/category/:id
   * Drill-down específico por categoría contable
   */
  async drillDownCategory(req, res, next) {
    try {
      const { id } = req.params;

      // ✅ VALIDAR ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID de categoría inválido'
        });
      }

      const categoryId = parseInt(id);
      console.log(`🔍 Drill-down for category ID: ${categoryId}`);

      // Crear filtros específicos para esta categoría
      const filters = { category_id: categoryId };
      const pagination = { page: 1, limit: 50 };

      // Usar el método de exploración con filtro específico
      const result = await multidimensionalModel.exploreCosts(filters, pagination);

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        metadata: {
          category_id: categoryId,
          total_costs: result.pagination.total,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in drillDownCategory controller:', error);
      next(error);
    }
  },

  // ==========================================
  // RESÚMENES EJECUTIVOS
  // ==========================================

  /**
   * GET /api/costs/executive-summary
   * Resumen ejecutivo multidimensional
   */
  async getExecutiveSummary(req, res, next) {
    try {
      console.log('📊 Generating executive summary...');

      // ✅ OBTENER RESUMEN DEL MODELO
      const summary = await multidimensionalModel.getExecutiveSummary();

      // ✅ CALCULAR MÉTRICAS ADICIONALES
      const totalIncome = summary.transaction_summary
        .find(t => t.transaction_type === 'ingreso')?.total_amount || 0;
      
      const totalExpenses = summary.transaction_summary
        .find(t => t.transaction_type === 'gasto')?.total_amount || 0;
      
      const netResult = totalIncome - totalExpenses;

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: {
          ...summary,
          calculated_metrics: {
            total_income: totalIncome,
            total_expenses: totalExpenses,
            net_result: netResult,
            expense_ratio: totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0
          }
        },
        metadata: {
          top_centers_analyzed: summary.top_cost_centers.length,
          categories_analyzed: summary.category_distribution.length,
          monthly_periods: summary.monthly_evolution.length,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in getExecutiveSummary controller:', error);
      next(error);
    }
  },

  // ==========================================
  // ESTADÍSTICAS RÁPIDAS
  // ==========================================

  /**
   * GET /api/costs/quick-stats
   * Estadísticas rápidas para dashboard
   */
  async getQuickStats(req, res, next) {
    try {
      console.log('⚡ Getting quick stats with filters:', req.query);

      // ✅ VALIDAR FILTROS OPCIONALES
      const filters = {};

      if (req.query.period_year && !isNaN(parseInt(req.query.period_year))) {
        filters.period_year = parseInt(req.query.period_year);
      }

      if (req.query.period_month && !isNaN(parseInt(req.query.period_month))) {
        const month = parseInt(req.query.period_month);
        if (month >= 1 && month <= 12) {
          filters.period_month = month;
        }
      }

      if (req.query.cost_center_type) {
        filters.cost_center_type = req.query.cost_center_type.trim();
      }

      // ✅ OBTENER ESTADÍSTICAS DEL MODELO
      const stats = await multidimensionalModel.getQuickStats(filters);

      // ✅ CALCULAR MÉTRICAS DERIVADAS
      const derivedMetrics = {
        net_amount: stats.total_income - stats.total_expenses,
        expense_ratio: stats.total_income > 0 ? (stats.total_expenses / stats.total_income) * 100 : 0,
        avg_expense: stats.total_expenses > 0 ? stats.total_expenses / stats.total_transactions : 0,
        transactions_per_center: stats.unique_cost_centers > 0 ? stats.total_transactions / stats.unique_cost_centers : 0
      };

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: {
          ...stats,
          derived_metrics: derivedMetrics
        },
        applied_filters: filters,
        metadata: {
          period: filters.period_year ? `${filters.period_year}${filters.period_month ? `-${filters.period_month.toString().padStart(2, '0')}` : ''}` : 'all',
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in getQuickStats controller:', error);
      next(error);
    }
  },

  // ==========================================
  // COMPARACIONES Y ANÁLISIS AVANZADOS
  // ==========================================

  /**
   * GET /api/costs/compare
   * Comparar diferentes dimensiones
   */
  async compareDimensions(req, res, next) {
    try {
      const { dimension, values } = req.query;

      if (!dimension || !values) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren parámetros: dimension y values'
        });
      }

      // ✅ VALIDAR DIMENSIÓN
      const validDimensions = [
        'cost_center_id', 'category_id', 'employee_id', 
        'supplier_id', 'period_month', 'period_year'
      ];

      if (!validDimensions.includes(dimension)) {
        return res.status(400).json({
          success: false,
          message: `Dimensión no válida. Opciones: ${validDimensions.join(', ')}`
        });
      }

      // ✅ PROCESAR VALORES A COMPARAR
      const valuesList = Array.isArray(values) ? values : values.split(',');
      const comparisons = [];

      for (const value of valuesList) {
        const filters = { [dimension]: value.trim() };
        const pagination = { page: 1, limit: 1 }; // Solo necesitamos stats

        try {
          const result = await multidimensionalModel.exploreCosts(filters, pagination);
          const stats = await multidimensionalModel.getQuickStats(filters);

          comparisons.push({
            dimension_value: value.trim(),
            total_transactions: result.pagination.total,
            stats: stats
          });
        } catch (error) {
          console.error(`Error comparing ${dimension}=${value}:`, error);
          comparisons.push({
            dimension_value: value.trim(),
            error: 'Error al obtener datos'
          });
        }
      }

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        data: {
          dimension: dimension,
          comparisons: comparisons
        },
        metadata: {
          compared_values: valuesList.length,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in compareDimensions controller:', error);
      next(error);
    }
  }
};

