// src/models/expenseDashboardModel.mjs
// Modelo para consultas de dashboard de egresos

import { pool } from '../config/database.mjs';

/**
 * Obtener resumen completo del dashboard
 */
export async function getDashboardSummary(organizationId, filters = {}) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      COUNT(e.id) as total_count,
      COALESCE(SUM(e.amount), 0) as total_amount,
      COALESCE(AVG(e.amount), 0) as avg_amount,
      MIN(e.date) as first_date,
      MAX(e.date) as last_date
    FROM expenses_data e
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0] || { total_count: 0, total_amount: 0, avg_amount: 0, first_date: null, last_date: null };
}

/**
 * Distribución por tipo con porcentajes
 */
export async function getDistributionByType(organizationId, filters = {}) {
  const { date_from, date_to, cost_center_id } = filters;

  // Build subquery conditions
  let subqueryConditions = '';
  if (date_from) subqueryConditions += ' AND date >= ?';
  if (date_to) subqueryConditions += ' AND date <= ?';
  if (cost_center_id) subqueryConditions += ' AND cost_center_id = ?';

  let sql = `
    SELECT
      et.id as type_id,
      et.name as type_name,
      et.color as type_color,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount,
      ROUND(
        COALESCE(SUM(e.amount), 0) * 100.0 /
        NULLIF((SELECT SUM(amount) FROM expenses_data WHERE organization_id = ?${subqueryConditions}), 0),
        2
      ) as percentage
    FROM expense_types et
    LEFT JOIN expenses_data e ON et.id = e.expense_type_id
      AND e.organization_id = ?
  `;

  const params = [organizationId];
  if (date_from) params.push(date_from);
  if (date_to) params.push(date_to);
  if (cost_center_id) params.push(cost_center_id);
  params.push(organizationId);

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    WHERE et.organization_id = ?
    GROUP BY et.id, et.name, et.color
    HAVING count > 0
    ORDER BY total_amount DESC
  `;

  params.push(organizationId);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Distribución jerárquica por tipo y categoría (para treemap)
 */
export async function getHierarchicalDistribution(organizationId, filters = {}) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      et.id as type_id,
      et.name as type_name,
      et.color as type_color,
      ec.id as category_id,
      ec.name as category_name,
      ec.color as category_color,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses_data e
    JOIN expense_types et ON e.expense_type_id = et.id
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    GROUP BY et.id, et.name, et.color, ec.id, ec.name, ec.color
    ORDER BY et.name, total_amount DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Distribución por estado
 */
export async function getDistributionByStatus(organizationId, filters = {}) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      s.id as status_id,
      s.name as status_name,
      s.color as status_color,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expense_statuses s
    LEFT JOIN expenses_data e ON s.id = e.status_id
      AND e.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    WHERE s.organization_id = ?
    GROUP BY s.id, s.name, s.color
    HAVING count > 0
    ORDER BY total_amount DESC
  `;

  params.push(organizationId);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Flujo de caja agrupado por período
 */
export async function getCashFlowByPeriod(organizationId, period, filters = {}) {
  const { date_from: dateFrom, date_to: dateTo, cost_center_id } = filters;

  const periodFormats = {
    week: '%Y-%u',
    month: '%Y-%m',
    quarter: 'CONCAT(YEAR(date), "-Q", QUARTER(date))',
    year: '%Y'
  };

  const periodFormat = periodFormats[period] || periodFormats.month;
  const isQuarter = period === 'quarter';

  let sql = `
    SELECT
      ${isQuarter ? periodFormat : `DATE_FORMAT(e.date, '${periodFormat}')`} as period_label,
      MIN(e.date) as period_start,
      MAX(e.date) as period_end,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses_data e
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (dateFrom) {
    sql += ` AND e.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND e.date <= ?`;
    params.push(dateTo);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    GROUP BY period_label
    ORDER BY period_label ASC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Comparación de períodos para tendencias
 */
export async function getPeriodComparison(organizationId, currentDateFrom, currentDateTo, previousDateFrom, previousDateTo) {
  const sql = `
    SELECT
      'current' as period_type,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses_data e
    WHERE e.organization_id = ?
      AND e.date BETWEEN ? AND ?

    UNION ALL

    SELECT
      'previous' as period_type,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses_data e
    WHERE e.organization_id = ?
      AND e.date BETWEEN ? AND ?
  `;

  const [rows] = await pool.query(sql, [
    organizationId, currentDateFrom, currentDateTo,
    organizationId, previousDateFrom, previousDateTo
  ]);

  const current = rows.find(r => r.period_type === 'current') || { count: 0, total_amount: 0 };
  const previous = rows.find(r => r.period_type === 'previous') || { count: 0, total_amount: 0 };

  return { current, previous };
}

/**
 * Top tipos de egreso por monto
 */
export async function getTopExpenseTypes(organizationId, filters = {}, limit = 5) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      et.id as type_id,
      et.name as type_name,
      et.color as type_color,
      COUNT(e.id) as count,
      COALESCE(SUM(e.amount), 0) as total_amount
    FROM expense_types et
    LEFT JOIN expenses_data e ON et.id = e.expense_type_id
      AND e.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    WHERE et.organization_id = ?
    GROUP BY et.id, et.name, et.color
    HAVING count > 0
    ORDER BY total_amount DESC
    LIMIT ?
  `;

  params.push(organizationId, limit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Egresos recientes
 */
export async function getRecentExpenses(organizationId, filters = {}, limit = 10) {
  const { cost_center_id } = filters;

  let sql = `
    SELECT
      e.id,
      e.name,
      e.amount,
      e.date,
      et.name as expense_type_name,
      et.color as type_color,
      s.name as status_name,
      s.color as status_color
    FROM expenses_data e
    LEFT JOIN expense_types et ON e.expense_type_id = et.id
    LEFT JOIN expense_statuses s ON e.status_id = s.id
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ?
  `;

  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Obtener distribución por categoría y período
 */
export async function getCategoryByPeriod(organizationId, period = 'month', filters = {}) {
  const { date_from: dateFrom, date_to: dateTo, cost_center_id } = filters;

  // Determinar formato de agrupación
  let periodFormat;
  let isQuarter = false;

  switch (period) {
    case 'week':
      periodFormat = '%Y-W%u'; // Año-Semana ISO
      break;
    case 'month':
      periodFormat = '%Y-%m'; // Año-Mes
      break;
    case 'quarter':
      isQuarter = true;
      periodFormat = `CONCAT(YEAR(e.date), '-Q', QUARTER(e.date))`;
      break;
    case 'year':
      periodFormat = '%Y'; // Año
      break;
    default:
      periodFormat = '%Y-%m';
  }

  let sql = `
    SELECT
      ec.id as category_id,
      ec.name as category_name,
      et.id as type_id,
      et.name as type_name,
      ${isQuarter ? periodFormat : `DATE_FORMAT(e.date, '${periodFormat}')`} as period_label,
      COALESCE(SUM(e.amount), 0) as total_amount,
      COUNT(e.id) as count
    FROM expenses_data e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    LEFT JOIN expense_types et ON e.expense_type_id = et.id
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (dateFrom) {
    sql += ` AND e.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND e.date <= ?`;
    params.push(dateTo);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    GROUP BY period_label, ec.id, ec.name, et.id, et.name
    ORDER BY period_label ASC, et.name ASC, ec.name ASC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}
