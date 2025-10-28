// src/controllers/incomeDashboardController.mjs
// Controlador para endpoints de dashboard de ingresos

import * as incomeDashboardModel from '../models/incomeDashboardModel.mjs';

/**
 * Calcular rango de fechas para período anterior
 */
function calculatePreviousPeriod(dateFrom, dateTo) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);

  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - diffDays);

  return {
    date_from: prevFrom.toISOString().split('T')[0],
    date_to: prevTo.toISOString().split('T')[0]
  };
}

/**
 * GET /api/incomes/dashboard/summary
 * Retorna resumen completo para el dashboard
 */
export async function getIncomeDashboardSummary(req, res) {
  try {
    const { organization_id } = req.user;
    const { date_from, date_to, period = 'month', cost_center_id } = req.query;

    // Construir filtros
    const filters = { date_from, date_to };
    if (cost_center_id) {
      filters.cost_center_id = parseInt(cost_center_id);
    }

    console.log('[incomeDashboardController] Filtros recibidos:', filters);

    // Obtener datos en paralelo
    const [
      summary,
      byType,
      byCategory,
      byStatus,
      topTypes,
      recentIncomes
    ] = await Promise.all([
      incomeDashboardModel.getDashboardSummary(organization_id, filters),
      incomeDashboardModel.getDistributionByType(organization_id, filters),
      incomeDashboardModel.getHierarchicalDistribution(organization_id, filters),
      incomeDashboardModel.getDistributionByStatus(organization_id, filters),
      incomeDashboardModel.getTopIncomeTypes(organization_id, filters, 5),
      incomeDashboardModel.getRecentIncomes(organization_id, filters, 10)
    ]);

    // Calcular tendencia comparando con período anterior
    let trend_percentage = 0;
    let trend_direction = 'stable';

    if (date_from && date_to) {
      const previousPeriod = calculatePreviousPeriod(date_from, date_to);
      const comparison = await incomeDashboardModel.getPeriodComparison(
        organization_id,
        date_from,
        date_to,
        previousPeriod.date_from,
        previousPeriod.date_to
      );

      const currentAmount = parseFloat(comparison.current.total_amount) || 0;
      const previousAmount = parseFloat(comparison.previous.total_amount) || 0;

      if (previousAmount > 0) {
        trend_percentage = ((currentAmount - previousAmount) / previousAmount) * 100;
        trend_direction = trend_percentage > 1 ? 'up' : trend_percentage < -1 ? 'down' : 'stable';
      } else if (currentAmount > 0) {
        trend_percentage = 100;
        trend_direction = 'up';
      }
    }

    res.json({
      success: true,
      data: {
        total_amount: parseFloat(summary.total_amount) || 0,
        total_count: parseInt(summary.total_count) || 0,
        avg_amount: parseFloat(summary.avg_amount) || 0,
        by_type: byType.map(t => ({
          type_id: t.type_id,
          type_name: t.type_name,
          type_color: t.type_color,
          total_amount: parseFloat(t.total_amount) || 0,
          count: parseInt(t.count) || 0,
          percentage: parseFloat(t.percentage) || 0
        })),
        by_category: byCategory.map(c => ({
          category_id: c.category_id,
          category_name: c.category_name || 'Sin categoría',
          type_id: c.type_id,
          type_name: c.type_name,
          type_color: c.type_color,
          category_color: c.category_color,
          total_amount: parseFloat(c.total_amount) || 0,
          count: parseInt(c.count) || 0
        })),
        by_status: byStatus.map(s => ({
          status_id: s.status_id,
          status_name: s.status_name,
          status_color: s.status_color,
          total_amount: parseFloat(s.total_amount) || 0,
          count: parseInt(s.count) || 0
        })),
        trend_percentage: parseFloat(trend_percentage.toFixed(2)),
        trend_direction,
        top_income_types: topTypes.map(t => ({
          type_id: t.type_id,
          type_name: t.type_name,
          type_color: t.type_color,
          total_amount: parseFloat(t.total_amount) || 0,
          count: parseInt(t.count) || 0
        })),
        recent_incomes: recentIncomes
      }
    });
  } catch (error) {
    console.error('Error en getIncomeDashboardSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de dashboard',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/dashboard/by-type
 * Retorna distribución por tipo de ingreso
 */
export async function getIncomesByType(req, res) {
  try {
    const { organization_id } = req.user;
    const { date_from, date_to, cost_center_id } = req.query;

    const filters = { date_from, date_to };
    if (cost_center_id) {
      filters.cost_center_id = parseInt(cost_center_id);
    }

    const data = await incomeDashboardModel.getDistributionByType(organization_id, filters);

    res.json({
      success: true,
      data: data.map(t => ({
        type_id: t.type_id,
        type_name: t.type_name,
        type_color: t.type_color,
        total_amount: parseFloat(t.total_amount) || 0,
        count: parseInt(t.count) || 0,
        percentage: parseFloat(t.percentage) || 0
      }))
    });
  } catch (error) {
    console.error('Error en getIncomesByType:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por tipo',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/dashboard/by-category
 * Retorna distribución por categoría
 */
export async function getIncomesByCategory(req, res) {
  try {
    const { organization_id } = req.user;
    const { date_from, date_to, cost_center_id } = req.query;

    const filters = { date_from, date_to };
    if (cost_center_id) {
      filters.cost_center_id = parseInt(cost_center_id);
    }

    const data = await incomeDashboardModel.getHierarchicalDistribution(organization_id, filters);

    res.json({
      success: true,
      data: data.map(c => ({
        category_id: c.category_id,
        category_name: c.category_name || 'Sin categoría',
        category_color: c.category_color,
        type_id: c.type_id,
        type_name: c.type_name,
        type_color: c.type_color,
        total_amount: parseFloat(c.total_amount) || 0,
        count: parseInt(c.count) || 0
      }))
    });
  } catch (error) {
    console.error('Error en getIncomesByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por categoría',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/dashboard/cash-flow
 * Retorna flujo de caja por período
 */
export async function getIncomeCashFlow(req, res) {
  try {
    const { organization_id } = req.user;
    const { period = 'month', date_from, date_to, cost_center_id } = req.query;

    const validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Período inválido. Debe ser: week, month, quarter o year'
      });
    }

    const filters = { date_from, date_to };
    if (cost_center_id) {
      filters.cost_center_id = parseInt(cost_center_id);
    }

    const data = await incomeDashboardModel.getCashFlowByPeriod(organization_id, period, filters);

    res.json({
      success: true,
      data: data.map(p => ({
        period_label: p.period_label,
        period_start: p.period_start,
        period_end: p.period_end,
        total_amount: parseFloat(p.total_amount) || 0,
        count: parseInt(p.count) || 0
      }))
    });
  } catch (error) {
    console.error('Error en getIncomeCashFlow:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener flujo de caja',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/dashboard/trends
 * Retorna tendencias y comparativas
 */
export async function getIncomeTrends(req, res) {
  try {
    const { organization_id } = req.user;
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren date_from y date_to'
      });
    }

    const previousPeriod = calculatePreviousPeriod(date_from, date_to);
    const comparison = await incomeDashboardModel.getPeriodComparison(
      organization_id,
      date_from,
      date_to,
      previousPeriod.date_from,
      previousPeriod.date_to
    );

    const currentAmount = parseFloat(comparison.current.total_amount) || 0;
    const previousAmount = parseFloat(comparison.previous.total_amount) || 0;

    let growth_rate = 0;
    let trend_direction = 'stable';

    if (previousAmount > 0) {
      growth_rate = ((currentAmount - previousAmount) / previousAmount) * 100;
      trend_direction = growth_rate > 1 ? 'up' : growth_rate < -1 ? 'down' : 'stable';
    } else if (currentAmount > 0) {
      growth_rate = 100;
      trend_direction = 'up';
    }

    res.json({
      success: true,
      data: {
        current_period: {
          date_from,
          date_to,
          amount: currentAmount,
          count: parseInt(comparison.current.count) || 0
        },
        previous_period: {
          date_from: previousPeriod.date_from,
          date_to: previousPeriod.date_to,
          amount: previousAmount,
          count: parseInt(comparison.previous.count) || 0
        },
        growth_rate: parseFloat(growth_rate.toFixed(2)),
        trend_direction
      }
    });
  } catch (error) {
    console.error('Error en getIncomeTrends:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tendencias',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/dashboard/category-by-period
 * Retorna distribución por categoría y período
 */
export async function getIncomesCategoryByPeriod(req, res) {
  try {
    const { organization_id } = req.user;
    const { date_from, date_to, period = 'month', cost_center_id } = req.query;

    const filters = { date_from, date_to };
    if (cost_center_id) {
      filters.cost_center_id = parseInt(cost_center_id);
    }

    const data = await incomeDashboardModel.getCategoryByPeriod(organization_id, period, filters);

    res.json({
      success: true,
      data: data.map(item => ({
        category_id: item.category_id,
        category_name: item.category_name || 'Sin categoría',
        type_id: item.type_id,
        type_name: item.type_name,
        period_label: item.period_label,
        total_amount: parseFloat(item.total_amount) || 0,
        count: parseInt(item.count) || 0
      }))
    });
  } catch (error) {
    console.error('Error en getIncomesCategoryByPeriod:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por categoría y período',
      error: error.message
    });
  }
}
