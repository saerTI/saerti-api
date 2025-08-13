// src/controllers/cashFlowController.mjs - Controlador mejorado similar a costsController
import cashFlowModel from '../models/cashFlowModel.mjs';
import { validationResult } from 'express-validator';

// ==========================================
// OBTENER DATOS PRINCIPALES DEL FLUJO DE CAJA
// ==========================================

/**
 * GET /api/cash-flow/data
 * Obtener datos principales del flujo de caja con filtros
 */
export const getCashFlowData = async (req, res) => {
  try {
    console.log('🔄 Getting cash flow data with filters:', req.query);
    
    // Procesar filtros
    const {
      period_type = 'monthly',
      year = new Date().getFullYear().toString(),
      project_id,
      cost_center_id,
      category_id,
      state,
      type = 'all'
    } = req.query;

    const filters = {
      period_type,
      year: parseInt(year),
      project_id: project_id && project_id !== 'all' ? parseInt(project_id) : null,
      cost_center_id: cost_center_id && cost_center_id !== 'all' ? parseInt(cost_center_id) : null,
      category_id: category_id && category_id !== 'all' ? parseInt(category_id) : null,
      state: state && state !== 'all' ? state : null,
      type: type && type !== 'all' ? type : null
    };

    // 1. Obtener resumen
    const summary = await cashFlowModel.getSummary(filters);
    
    // 2. Obtener movimientos recientes (últimos 10)
    const recentItems = await cashFlowModel.getRecentItems(filters, 10);
    
    // 3. Obtener datos por categoría
    const byCategoryData = await cashFlowModel.getByCategory(filters);
    
    // 4. Obtener categorías vacías
    const emptyCategoriesData = await cashFlowModel.getEmptyCategories(filters);
    
    // 5. Obtener datos para gráfico (últimas 12 semanas/meses)
    const chartData = await cashFlowModel.getChartData(filters);

    const responseData = {
      summary: {
        totalIncome: summary.total_income || 0,
        totalExpense: summary.total_expense || 0,
        netCashFlow: (summary.total_income || 0) - (summary.total_expense || 0),
        forecastIncome: summary.forecast_income || 0,
        forecastExpense: summary.forecast_expense || 0,
        actualIncome: summary.actual_income || 0,
        actualExpense: summary.actual_expense || 0,
        pendingItems: summary.pending_items || 0,
        totalItems: summary.total_items || 0,
        previousPeriodChange: summary.previous_period_change || 0
      },
      recentItems: recentItems.map(item => ({
        id: item.id,
        name: item.name,
        category_name: item.category_name,
        planned_date: item.planned_date,
        actual_date: item.actual_date,
        amount: parseFloat(item.amount),
        state: item.state,
        type: item.type,
        cost_center_name: item.cost_center_name,
        notes: item.notes
      })),
      byCategoryData: byCategoryData.map(category => ({
        category_id: category.category_id,
        category_name: category.category_name,
        category_type: category.category_type,
        income_amount: parseFloat(category.income_amount || 0),
        expense_amount: parseFloat(category.expense_amount || 0),
        net_amount: parseFloat(category.net_amount || 0),
        items_count: category.items_count || 0,
        path: `/cash-flow/categories/${category.category_id}`
      })),
      emptyCategoriesData: emptyCategoriesData.map(category => ({
        category_id: category.category_id,
        category_name: category.category_name,
        category_type: category.category_type,
        income_amount: 0,
        expense_amount: 0,
        net_amount: 0,
        items_count: 0,
        path: `/cash-flow/categories/${category.category_id}`
      })),
      chartData: chartData.map(period => ({
        name: period.period_name,
        income: parseFloat(period.income || 0),
        expense: parseFloat(period.expense || 0),
        balance: parseFloat(period.balance || 0),
        forecast_income: parseFloat(period.forecast_income || 0),
        forecast_expense: parseFloat(period.forecast_expense || 0),
        actual_income: parseFloat(period.actual_income || 0),
        actual_expense: parseFloat(period.actual_expense || 0)
      }))
    };

    console.log('✅ Cash flow data processed successfully');
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in getCashFlowData:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de flujo de caja',
      error: error.message
    });
  }
};

// ==========================================
// OBTENER DATOS POR PERÍODO
// ==========================================

/**
 * GET /api/cash-flow/by-period
 * Obtener datos de flujo de caja agrupados por período para tabla financiera
 */
export const getCashFlowByPeriod = async (req, res) => {
  try {
    console.log('📊 Getting cash flow by period with filters:', req.query);
    
    const {
      period_type = 'monthly',
      year = new Date().getFullYear().toString(),
      project_id,
      cost_center_id,
      category_id,
      state,
      type = 'all'
    } = req.query;

    const filters = {
      period_type,
      year: parseInt(year),
      project_id: project_id && project_id !== 'all' ? parseInt(project_id) : null,
      cost_center_id: cost_center_id && cost_center_id !== 'all' ? parseInt(cost_center_id) : null,
      category_id: category_id && category_id !== 'all' ? parseInt(category_id) : null,
      state: state && state !== 'all' ? state : null,
      type: type && type !== 'all' ? type : null
    };

    // Obtener datos por período desde el modelo
    const periodData = await cashFlowModel.getByPeriod(filters);

    const responseData = periodData.map(period => ({
      name: period.period_name,
      income: parseFloat(period.income || 0),
      expense: parseFloat(period.expense || 0),
      balance: parseFloat(period.balance || 0),
      forecast_income: parseFloat(period.forecast_income || 0),
      forecast_expense: parseFloat(period.forecast_expense || 0),
      actual_income: parseFloat(period.actual_income || 0),
      actual_expense: parseFloat(period.actual_expense || 0)
    }));

    console.log('✅ Period data processed successfully:', responseData.length, 'periods');
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in getCashFlowByPeriod:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos por período',
      error: error.message
    });
  }
};

// ==========================================
// OBTENER OPCIONES PARA FILTROS
// ==========================================

/**
 * GET /api/cash-flow/filter-options
 * Obtener opciones disponibles para los filtros
 */
export const getFilterOptions = async (req, res) => {
  try {
    console.log('🔄 Getting filter options...');
    
    // Obtener proyectos (centros de costo tipo 'project')
    const projects = await cashFlowModel.getProjects();
    
    // Obtener centros de costo
    const costCenters = await cashFlowModel.getCostCenters();
    
    // Obtener categorías
    const categories = await cashFlowModel.getCategories();
    
    // Estados disponibles
    const states = [
      { value: 'forecast', label: 'Presupuestado' },
      { value: 'actual', label: 'Real' },
      { value: 'budget', label: 'Presupuesto' }
    ];

    const responseData = {
      projects: projects.map(project => ({
        value: project.id.toString(),
        label: project.name
      })),
      costCenters: costCenters.map(center => ({
        value: center.id.toString(),
        label: center.name
      })),
      categories: categories.map(category => ({
        value: category.id.toString(),
        label: category.name
      })),
      states: states
    };

    console.log('✅ Filter options processed successfully');
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in getFilterOptions:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener opciones de filtros',
      error: error.message
    });
  }
};

// ==========================================
// RESUMEN DEL FLUJO DE CAJA
// ==========================================

/**
 * GET /api/cash-flow/summary
 * Obtener resumen del flujo de caja
 */
export const getSummary = async (req, res) => {
  try {
    const filters = {
      project_id: req.query.project_id ? parseInt(req.query.project_id) : null,
      cost_center_id: req.query.cost_center_id ? parseInt(req.query.cost_center_id) : null,
      year: req.query.year ? parseInt(req.query.year) : new Date().getFullYear(),
      type: req.query.type || null
    };

    const summary = await cashFlowModel.getSummary(filters);

    const responseData = {
      totalIncome: summary.total_income || 0,
      totalExpense: summary.total_expense || 0,
      netCashFlow: (summary.total_income || 0) - (summary.total_expense || 0),
      forecastIncome: summary.forecast_income || 0,
      forecastExpense: summary.forecast_expense || 0,
      actualIncome: summary.actual_income || 0,
      actualExpense: summary.actual_expense || 0,
      pendingItems: summary.pending_items || 0,
      totalItems: summary.total_items || 0,
      previousPeriodChange: summary.previous_period_change || 0
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in getSummary:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen',
      error: error.message
    });
  }
};

// ==========================================
// CRUD OPERACIONES (mantener existentes)
// ==========================================

/**
 * GET /api/cash-flow/categories
 * Obtener categorías de flujo de caja
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await cashFlowModel.getCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('❌ Error getting categories:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      error: error.message
    });
  }
};

/**
 * POST /api/cash-flow/categories
 * Crear una nueva categoría
 */
export const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const categoryId = await cashFlowModel.createCategory(req.body);
    
    res.status(201).json({
      success: true,
      data: { id: categoryId },
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creating category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al crear categoría',
      error: error.message
    });
  }
};

/**
 * PUT /api/cash-flow/categories/:id
 * Actualizar una categoría
 */
export const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updated = await cashFlowModel.updateCategory(id, req.body);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error updating category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoría',
      error: error.message
    });
  }
};

/**
 * POST /api/cash-flow/lines
 * Crear una nueva línea de flujo de caja
 */
export const createCashFlowLine = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const lineId = await cashFlowModel.createLine(req.body);
    
    res.status(201).json({
      success: true,
      data: { id: lineId },
      message: 'Línea de flujo de caja creada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creating cash flow line:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al crear línea de flujo de caja',
      error: error.message
    });
  }
};

/**
 * PUT /api/cash-flow/lines/:id
 * Actualizar una línea de flujo de caja
 */
export const updateCashFlowLine = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updated = await cashFlowModel.updateLine(id, req.body);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Línea de flujo de caja no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Línea de flujo de caja actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error updating cash flow line:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar línea de flujo de caja',
      error: error.message
    });
  }
};

/**
 * DELETE /api/cash-flow/lines/:id
 * Eliminar una línea de flujo de caja
 */
export const deleteCashFlowLine = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await cashFlowModel.deleteLine(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Línea de flujo de caja no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Línea de flujo de caja eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error deleting cash flow line:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar línea de flujo de caja',
      error: error.message
    });
  }
};

// ==========================================
// OBTENER FLUJO DE CAJA DE UN PROYECTO
// ==========================================

/**
 * GET /api/projects/:projectId/cash-flow
 * Obtener flujo de caja de un proyecto específico
 */
export const getProjectCashFlow = async (req, res) => {
  try {
    const { projectId } = req.params;
    const filters = {
      type: req.query.type,
      state: req.query.state,
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };

    const cashFlowLines = await cashFlowModel.getProjectCashFlow(projectId, filters);
    
    res.json({
      success: true,
      data: cashFlowLines
    });
  } catch (error) {
    console.error('❌ Error getting project cash flow:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener flujo de caja del proyecto',
      error: error.message
    });
  }
};

/**
 * GET /api/projects/:projectId/cash-flow/summary
 * Obtener resumen del flujo de caja de un proyecto
 */
export const getCashFlowSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const summary = await cashFlowModel.getCashFlowSummary(projectId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Error getting cash flow summary:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del flujo de caja',
      error: error.message
    });
  }
};

/**
 * POST /api/projects/:projectId/incomes
 * Crear un nuevo ingreso para un proyecto (compatibilidad)
 */
export const createIncome = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { projectId } = req.params;
    const incomeData = {
      ...req.body,
      cost_center_id: parseInt(projectId),
      type: 'income'
    };

    const lineId = await cashFlowModel.createLine(incomeData);
    
    res.status(201).json({
      success: true,
      data: { id: lineId },
      message: 'Ingreso creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creating income:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al crear ingreso',
      error: error.message
    });
  }
};

/**
 * POST /api/projects/:projectId/expenses
 * Crear un nuevo gasto para un proyecto (compatibilidad)
 */
export const createExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { projectId } = req.params;
    const expenseData = {
      ...req.body,
      cost_center_id: parseInt(projectId),
      type: 'expense'
    };

    const lineId = await cashFlowModel.createLine(expenseData);
    
    res.status(201).json({
      success: true,
      data: { id: lineId },
      message: 'Gasto creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creating expense:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al crear gasto',
      error: error.message
    });
  }
};

// Exportar como default para mantener compatibilidad
export default {
  getCashFlowData,
  getCashFlowByPeriod,
  getFilterOptions,
  getSummary,
  getCategories,
  createCategory,
  updateCategory,
  createCashFlowLine,
  updateCashFlowLine,
  deleteCashFlowLine,
  getProjectCashFlow,
  getCashFlowSummary,
  createIncome,
  createExpense
};