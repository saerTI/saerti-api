// src/models/incomeDataModel.mjs
// Modelo para datos de ingresos (tabla unificada con todos los campos)

import db from '../config/database.mjs';

/**
 * Obtener todos los ingresos de un tipo con paginación y filtros
 * @param {Object} filters - Filtros de búsqueda
 */
export async function getAllIncomes(filters = {}) {
  const {
    organization_id,
    income_type_id,
    status_id,
    category_id,
    cost_center_id,
    date_from,
    date_to,
    payment_status,
    search,
    limit = 50,
    offset = 0
  } = filters;

  let sql = `
    SELECT
      i.*,
      it.name as income_type_name,
      s.name as status_name,
      s.color as status_color,
      c.name as category_name,
      cc.name as cost_center_name,
      u.email as created_by_email
    FROM incomes_data i
    LEFT JOIN income_types it ON i.income_type_id = it.id
    LEFT JOIN income_statuses s ON i.status_id = s.id
    LEFT JOIN income_categories c ON i.category_id = c.id
    LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
    LEFT JOIN users u ON i.created_by = u.id
    WHERE i.organization_id = ?
  `;

  const params = [organization_id];

  if (income_type_id) {
    sql += ` AND i.income_type_id = ?`;
    params.push(income_type_id);
  }

  if (status_id) {
    sql += ` AND i.status_id = ?`;
    params.push(status_id);
  }

  if (category_id) {
    sql += ` AND i.category_id = ?`;
    params.push(category_id);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (payment_status) {
    sql += ` AND i.payment_status = ?`;
    params.push(payment_status);
  }

  if (search) {
    sql += ` AND (i.name LIKE ? OR i.description LIKE ? OR i.reference_number LIKE ? OR i.invoice_number LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY i.date DESC, i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * Contar total de ingresos con filtros
 * @param {Object} filters - Filtros de búsqueda
 */
export async function countIncomes(filters = {}) {
  const {
    organization_id,
    income_type_id,
    status_id,
    category_id,
    cost_center_id,
    date_from,
    date_to,
    payment_status,
    search
  } = filters;

  let sql = `
    SELECT COUNT(*) as total
    FROM incomes_data i
    WHERE i.organization_id = ?
  `;

  const params = [organization_id];

  if (income_type_id) {
    sql += ` AND i.income_type_id = ?`;
    params.push(income_type_id);
  }

  if (status_id) {
    sql += ` AND i.status_id = ?`;
    params.push(status_id);
  }

  if (category_id) {
    sql += ` AND i.category_id = ?`;
    params.push(category_id);
  }

  if (cost_center_id) {
    sql += ` AND i.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  if (date_from) {
    sql += ` AND i.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND i.date <= ?`;
    params.push(date_to);
  }

  if (payment_status) {
    sql += ` AND i.payment_status = ?`;
    params.push(payment_status);
  }

  if (search) {
    sql += ` AND (i.name LIKE ? OR i.description LIKE ? OR i.reference_number LIKE ? OR i.invoice_number LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  const [rows] = await db.query(sql, params);
  return rows[0].total;
}

/**
 * Obtener un ingreso por ID
 * @param {number} id - ID del ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function getIncomeById(id, organizationId) {
  const sql = `
    SELECT
      i.*,
      it.name as income_type_name,
      s.name as status_name,
      s.color as status_color,
      c.name as category_name,
      cc.name as cost_center_name,
      u_created.email as created_by_email,
      u_updated.email as updated_by_email
    FROM incomes_data i
    LEFT JOIN income_types it ON i.income_type_id = it.id
    LEFT JOIN income_statuses s ON i.status_id = s.id
    LEFT JOIN income_categories c ON i.category_id = c.id
    LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
    LEFT JOIN users u_created ON i.created_by = u_created.id
    LEFT JOIN users u_updated ON i.updated_by = u_updated.id
    WHERE i.id = ? AND i.organization_id = ?
  `;

  const [rows] = await db.query(sql, [id, organizationId]);
  return rows[0] || null;
}

/**
 * Crear un nuevo ingreso
 * @param {Object} incomeData - Datos del ingreso
 */
export async function createIncome(incomeData) {
  const sql = `
    INSERT INTO incomes_data (
      income_type_id,
      organization_id,
      name,
      description,
      notes,
      date,
      status_id,
      cost_center_id,
      amount,
      category_id,
      payment_date,
      reference_number,
      tax_amount,
      net_amount,
      total_amount,
      payment_method,
      payment_status,
      currency,
      exchange_rate,
      invoice_number,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    incomeData.income_type_id,
    incomeData.organization_id,
    incomeData.name || null,
    incomeData.description || null,
    incomeData.notes || null,
    incomeData.date || null,
    incomeData.status_id || null,
    incomeData.cost_center_id || null,
    incomeData.amount || null,
    incomeData.category_id || null,
    incomeData.payment_date || null,
    incomeData.reference_number || null,
    incomeData.tax_amount || null,
    incomeData.net_amount || null,
    incomeData.total_amount || null,
    incomeData.payment_method || null,
    incomeData.payment_status || null,
    incomeData.currency || 'CLP',
    incomeData.exchange_rate || null,
    incomeData.invoice_number || null,
    incomeData.created_by || null
  ];

  const [result] = await db.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar un ingreso
 * @param {number} id - ID del ingreso
 * @param {string} organizationId - ID de la organización
 * @param {Object} incomeData - Datos a actualizar
 */
export async function updateIncome(id, organizationId, incomeData) {
  const sql = `
    UPDATE incomes_data
    SET
      name = ?,
      description = ?,
      notes = ?,
      date = ?,
      status_id = ?,
      cost_center_id = ?,
      amount = ?,
      category_id = ?,
      payment_date = ?,
      reference_number = ?,
      tax_amount = ?,
      net_amount = ?,
      total_amount = ?,
      payment_method = ?,
      payment_status = ?,
      currency = ?,
      exchange_rate = ?,
      invoice_number = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    incomeData.name || null,
    incomeData.description || null,
    incomeData.notes || null,
    incomeData.date || null,
    incomeData.status_id || null,
    incomeData.cost_center_id || null,
    incomeData.amount || null,
    incomeData.category_id || null,
    incomeData.payment_date || null,
    incomeData.reference_number || null,
    incomeData.tax_amount || null,
    incomeData.net_amount || null,
    incomeData.total_amount || null,
    incomeData.payment_method || null,
    incomeData.payment_status || null,
    incomeData.currency || 'CLP',
    incomeData.exchange_rate || null,
    incomeData.invoice_number || null,
    incomeData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await db.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar un ingreso permanentemente
 * @param {number} id - ID del ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function deleteIncome(id, organizationId) {
  const sql = `
    DELETE FROM incomes_data
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await db.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Obtener estadísticas de ingresos por tipo
 * @param {string} organizationId - ID de la organización
 * @param {number} incomeTypeId - ID del tipo (opcional)
 * @param {string} dateFrom - Fecha inicio (opcional)
 * @param {string} dateTo - Fecha fin (opcional)
 */
export async function getIncomeStats(organizationId, incomeTypeId = null, dateFrom = null, dateTo = null) {
  let sql = `
    SELECT
      i.income_type_id,
      it.name as income_type_name,
      COUNT(i.id) as total_count,
      SUM(i.amount) as total_amount,
      SUM(i.total_amount) as total_with_tax,
      AVG(i.amount) as avg_amount,
      MIN(i.date) as first_date,
      MAX(i.date) as last_date
    FROM incomes_data i
    LEFT JOIN income_types it ON i.income_type_id = it.id
    WHERE i.organization_id = ?
  `;

  const params = [organizationId];

  if (incomeTypeId) {
    sql += ` AND i.income_type_id = ?`;
    params.push(incomeTypeId);
  }

  if (dateFrom) {
    sql += ` AND i.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND i.date <= ?`;
    params.push(dateTo);
  }

  sql += ` GROUP BY i.income_type_id, it.name`;

  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * Obtener ingresos agrupados por estado
 * @param {string} organizationId - ID de la organización
 * @param {number} incomeTypeId - ID del tipo
 */
export async function getIncomesByStatus(organizationId, incomeTypeId) {
  const sql = `
    SELECT
      s.id as status_id,
      s.name as status_name,
      s.color as status_color,
      s.is_final,
      COUNT(i.id) as count,
      SUM(i.amount) as total_amount
    FROM income_statuses s
    LEFT JOIN incomes_data i ON s.id = i.status_id AND i.organization_id = ?
    WHERE s.income_type_id = ? AND s.organization_id = ? AND s.is_active = TRUE
    GROUP BY s.id, s.name, s.color, s.is_final
    ORDER BY s.name
  `;

  const [rows] = await db.query(sql, [organizationId, incomeTypeId, organizationId]);
  return rows;
}
