// src/models/expenseDataModel.mjs
// Modelo para datos de egresos (tabla unificada con todos los campos)

import { pool } from '../config/database.mjs';

/**
 * Obtener todos los egresos de un tipo con paginación y filtros
 * @param {Object} filters - Filtros de búsqueda
 */
export async function getAllExpenses(filters = {}) {
  const {
    organization_id,
    expense_type_id,
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
      e.*,
      et.name as expense_type_name,
      s.name as status_name,
      s.color as status_color,
      c.name as category_name,
      cc.name as cost_center_name,
      u.email as created_by_email
    FROM expenses_data e
    LEFT JOIN expense_types et ON e.expense_type_id = et.id
    LEFT JOIN expense_statuses s ON e.status_id = s.id
    LEFT JOIN expense_categories c ON e.category_id = c.id
    LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.organization_id = ?
  `;

  const params = [organization_id];

  if (expense_type_id) {
    sql += ` AND e.expense_type_id = ?`;
    params.push(expense_type_id);
  }

  if (status_id) {
    sql += ` AND e.status_id = ?`;
    params.push(status_id);
  }

  if (category_id) {
    sql += ` AND e.category_id = ?`;
    params.push(category_id);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (payment_status) {
    sql += ` AND e.payment_status = ?`;
    params.push(payment_status);
  }

  if (search) {
    sql += ` AND (e.name LIKE ? OR e.description LIKE ? OR e.reference_number LIKE ? OR e.invoice_number LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY e.date DESC, e.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Contar total de egresos con filtros
 * @param {Object} filters - Filtros de búsqueda
 */
export async function countExpenses(filters = {}) {
  const {
    organization_id,
    expense_type_id,
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
    FROM expenses_data e
    WHERE e.organization_id = ?
  `;

  const params = [organization_id];

  if (expense_type_id) {
    sql += ` AND e.expense_type_id = ?`;
    params.push(expense_type_id);
  }

  if (status_id) {
    sql += ` AND e.status_id = ?`;
    params.push(status_id);
  }

  if (category_id) {
    sql += ` AND e.category_id = ?`;
    params.push(category_id);
  }

  if (cost_center_id) {
    sql += ` AND e.cost_center_id = ?`;
    params.push(cost_center_id);
  }

  if (date_from) {
    sql += ` AND e.date >= ?`;
    params.push(date_from);
  }

  if (date_to) {
    sql += ` AND e.date <= ?`;
    params.push(date_to);
  }

  if (payment_status) {
    sql += ` AND e.payment_status = ?`;
    params.push(payment_status);
  }

  if (search) {
    sql += ` AND (e.name LIKE ? OR e.description LIKE ? OR e.reference_number LIKE ? OR e.invoice_number LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0].total;
}

/**
 * Obtener un egreso por ID
 * @param {number} id - ID del egreso
 * @param {string} organizationId - ID de la organización
 */
export async function getExpenseById(id, organizationId) {
  const sql = `
    SELECT
      e.*,
      et.name as expense_type_name,
      s.name as status_name,
      s.color as status_color,
      c.name as category_name,
      cc.name as cost_center_name,
      u_created.email as created_by_email,
      u_updated.email as updated_by_email
    FROM expenses_data e
    LEFT JOIN expense_types et ON e.expense_type_id = et.id
    LEFT JOIN expense_statuses s ON e.status_id = s.id
    LEFT JOIN expense_categories c ON e.category_id = c.id
    LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
    LEFT JOIN users u_created ON e.created_by = u_created.id
    LEFT JOIN users u_updated ON e.updated_by = u_updated.id
    WHERE e.id = ? AND e.organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0] || null;
}

/**
 * Crear un nuevo egreso
 * @param {Object} expenseData - Datos del egreso
 */
export async function createExpense(expenseData) {
  const sql = `
    INSERT INTO expenses_data (
      expense_type_id,
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
      payment_method,
      payment_status,
      currency,
      exchange_rate,
      invoice_number,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    expenseData.expense_type_id,
    expenseData.organization_id,
    expenseData.name || null,
    expenseData.description || null,
    expenseData.notes || null,
    expenseData.date || null,
    expenseData.status_id || null,
    expenseData.cost_center_id || null,
    expenseData.amount || null,
    expenseData.category_id || null,
    expenseData.payment_date || null,
    expenseData.reference_number || null,
    expenseData.payment_method || null,
    expenseData.payment_status || null,
    expenseData.currency || 'CLP',
    expenseData.exchange_rate || null,
    expenseData.invoice_number || null,
    expenseData.created_by || null
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar un egreso
 * @param {number} id - ID del egreso
 * @param {string} organizationId - ID de la organización
 * @param {Object} expenseData - Datos a actualizar
 */
export async function updateExpense(id, organizationId, expenseData) {
  const sql = `
    UPDATE expenses_data
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
      payment_method = ?,
      payment_status = ?,
      currency = ?,
      exchange_rate = ?,
      invoice_number = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    expenseData.name || null,
    expenseData.description || null,
    expenseData.notes || null,
    expenseData.date || null,
    expenseData.status_id || null,
    expenseData.cost_center_id || null,
    expenseData.amount || null,
    expenseData.category_id || null,
    expenseData.payment_date || null,
    expenseData.reference_number || null,
    expenseData.payment_method || null,
    expenseData.payment_status || null,
    expenseData.currency || 'CLP',
    expenseData.exchange_rate || null,
    expenseData.invoice_number || null,
    expenseData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar un egreso permanentemente
 * @param {number} id - ID del egreso
 * @param {string} organizationId - ID de la organización
 */
export async function deleteExpense(id, organizationId) {
  const sql = `
    DELETE FROM expenses_data
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Obtener estadísticas de egresos por tipo
 * @param {string} organizationId - ID de la organización
 * @param {number} expenseTypeId - ID del tipo (opcional)
 * @param {string} dateFrom - Fecha inicio (opcional)
 * @param {string} dateTo - Fecha fin (opcional)
 */
export async function getExpenseStats(organizationId, expenseTypeId = null, dateFrom = null, dateTo = null) {
  let sql = `
    SELECT
      e.expense_type_id,
      et.name as expense_type_name,
      COUNT(e.id) as total_count,
      SUM(e.amount) as total_amount,
      AVG(e.amount) as avg_amount,
      MIN(e.date) as first_date,
      MAX(e.date) as last_date
    FROM expenses_data e
    LEFT JOIN expense_types et ON e.expense_type_id = et.id
    WHERE e.organization_id = ?
  `;

  const params = [organizationId];

  if (expenseTypeId) {
    sql += ` AND e.expense_type_id = ?`;
    params.push(expenseTypeId);
  }

  if (dateFrom) {
    sql += ` AND e.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND e.date <= ?`;
    params.push(dateTo);
  }

  sql += ` GROUP BY e.expense_type_id, et.name`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Obtener egresos agrupados por estado
 * @param {string} organizationId - ID de la organización
 * @param {number} expenseTypeId - ID del tipo
 */
export async function getExpensesByStatus(organizationId, expenseTypeId) {
  const sql = `
    SELECT
      s.id as status_id,
      s.name as status_name,
      s.color as status_color,
      s.is_final,
      COUNT(e.id) as count,
      SUM(e.amount) as total_amount
    FROM expense_statuses s
    LEFT JOIN expenses_data e ON s.id = e.status_id AND e.organization_id = ?
    WHERE s.expense_type_id = ? AND s.organization_id = ? AND s.is_active = TRUE
    GROUP BY s.id, s.name, s.color, s.is_final
    ORDER BY s.name
  `;

  const [rows] = await pool.query(sql, [organizationId, expenseTypeId, organizationId]);
  return rows;
}
