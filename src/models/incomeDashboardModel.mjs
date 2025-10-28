// src/models/incomeDashboardModel.mjs
// Modelo para consultas de dashboard de ingresos

import { pool } from '../config/database.mjs';

/**
 * Obtener resumen completo del dashboard
 */
export async function getDashboardSummary(organizationId, filters = {}) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      COUNT(i.id) as total_count,
      COALESCE(SUM(i.amount), 0) as total_amount,
      COALESCE(AVG(i.amount), 0) as avg_amount,
      MIN(i.date) as first_date,
      MAX(i.date) as last_date
    FROM incomes_data i
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
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
      it.id as type_id,
      it.name as type_name,
      it.color as type_color,
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount,
      ROUND(
        COALESCE(SUM(i.amount), 0) * 100.0 /
        NULLIF((SELECT SUM(amount) FROM incomes_data WHERE organization_id = ?${subqueryConditions}), 0),
        2
      ) as percentage
    FROM income_types it
    LEFT JOIN incomes_data i ON it.id = i.income_type_id
      AND i.organization_id = ?
  `;

  const params = [organizationId];
  if (date_from) params.push(date_from);
  if (date_to) params.push(date_to);
  if (cost_center_id) params.push(cost_center_id);
  params.push(organizationId);

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    WHERE it.organization_id = ?
    GROUP BY it.id, it.name, it.color
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
      it.id as type_id,
      it.name as type_name,
      it.color as type_color,
      ic.id as category_id,
      ic.name as category_name,
      ic.color as category_color,
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM incomes_data i
    JOIN income_types it ON i.income_type_id = it.id
    LEFT JOIN income_categories ic ON i.category_id = ic.id
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    GROUP BY it.id, it.name, it.color, ic.id, ic.name, ic.color
    ORDER BY it.name, total_amount DESC
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
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM income_statuses s
    LEFT JOIN incomes_data i ON s.id = i.status_id
      AND i.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
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
      ${isQuarter ? periodFormat : `DATE_FORMAT(i.date, '${periodFormat}')`} as period_label,
      MIN(i.date) as period_start,
      MAX(i.date) as period_end,
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM incomes_data i
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (dateFrom) {
    sql += ` AND i.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND i.date <= ?`;
    params.push(dateTo);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
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
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM incomes_data i
    WHERE i.organization_id = ?
      AND i.date BETWEEN ? AND ?

    UNION ALL

    SELECT
      'previous' as period_type,
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM incomes_data i
    WHERE i.organization_id = ?
      AND i.date BETWEEN ? AND ?
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
 * Top tipos de ingreso por monto
 */
export async function getTopIncomeTypes(organizationId, filters = {}, limit = 5) {
  const { date_from, date_to, cost_center_id } = filters;

  let sql = `
    SELECT
      it.id as type_id,
      it.name as type_name,
      it.color as type_color,
      COUNT(i.id) as count,
      COALESCE(SUM(i.amount), 0) as total_amount
    FROM income_types it
    LEFT JOIN incomes_data i ON it.id = i.income_type_id
      AND i.organization_id = ?
  `;

  const params = [organizationId];

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    WHERE it.organization_id = ?
    GROUP BY it.id, it.name, it.color
    HAVING count > 0
    ORDER BY total_amount DESC
    LIMIT ?
  `;

  params.push(organizationId, limit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Ingresos recientes
 */
export async function getRecentIncomes(organizationId, filters = {}, limit = 10) {
  const { cost_center_id } = filters;

  let sql = `
    SELECT
      i.id,
      i.name,
      i.amount,
      i.date,
      it.name as income_type_name,
      it.color as type_color,
      s.name as status_name,
      s.color as status_color
    FROM incomes_data i
    LEFT JOIN income_types it ON i.income_type_id = it.id
    LEFT JOIN income_statuses s ON i.status_id = s.id
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    ORDER BY i.date DESC, i.created_at DESC
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
      periodFormat = `CONCAT(YEAR(i.date), '-Q', QUARTER(i.date))`;
      break;
    case 'year':
      periodFormat = '%Y'; // Año
      break;
    default:
      periodFormat = '%Y-%m';
  }

  let sql = `
    SELECT
      ic.id as category_id,
      ic.name as category_name,
      it.id as type_id,
      it.name as type_name,
      ${isQuarter ? periodFormat : `DATE_FORMAT(i.date, '${periodFormat}')`} as period_label,
      COALESCE(SUM(i.amount), 0) as total_amount,
      COUNT(i.id) as count
    FROM incomes_data i
    LEFT JOIN income_categories ic ON i.category_id = ic.id
    LEFT JOIN income_types it ON i.income_type_id = it.id
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (dateFrom) {
    sql += ` AND i.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND i.date <= ?`;
    params.push(dateTo);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  sql += `
    GROUP BY period_label, ic.id, ic.name, it.id, it.name
    ORDER BY period_label ASC, it.name ASC, ic.name ASC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}
