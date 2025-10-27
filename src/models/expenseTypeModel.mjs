// src/models/expenseTypeModel.mjs
// Modelo para gestión de tipos de egresos dinámicos

import { pool } from '../config/database.mjs';

/**
 * Convert MySQL TINYINT(1) to JavaScript boolean
 */
function convertToBoolean(row) {
  const booleanFields = [
    'show_amount', 'show_category', 'show_payment_date', 'show_reference_number',
    'show_payment_method', 'show_payment_status', 'show_currency', 'show_exchange_rate',
    'show_invoice_number', 'required_name', 'required_date', 'required_status',
    'required_cost_center', 'required_amount', 'required_category', 'required_payment_date',
    'required_reference_number', 'required_payment_method', 'required_payment_status',
    'required_currency', 'required_exchange_rate', 'required_invoice_number', 'is_active'
  ];

  const converted = { ...row };
  booleanFields.forEach(field => {
    if (field in converted) {
      converted[field] = Boolean(converted[field]);
    }
  });

  return converted;
}


/**
 * Obtener todos los tipos de egresos de una organización
 * @param {string} organizationId - ID de la organización
 * @param {boolean} onlyActive - Si es true, solo devuelve tipos activos
 */
export async function getAllExpenseTypes(organizationId, onlyActive = true) {
  const sql = `
    SELECT
      id,
      organization_id,
      name,
      description,
      icon,
      color,
      show_amount,
      show_category,
      show_payment_date,
      show_reference_number,
      show_payment_method,
      show_payment_status,
      show_currency,
      show_exchange_rate,
      show_invoice_number,
      required_name,
      required_date,
      required_status,
      required_cost_center,
      required_amount,
      required_category,
      required_payment_date,
      required_reference_number,
      required_payment_method,
      required_payment_status,
      required_currency,
      required_exchange_rate,
      required_invoice_number,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_types
    WHERE organization_id = ?
      ${onlyActive ? 'AND is_active = TRUE' : ''}
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [organizationId]);
  return rows.map(convertToBoolean);
}

/**
 * Obtener un tipo de egreso por ID
 * @param {number} id - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 */
export async function getExpenseTypeById(id, organizationId) {
  const sql = `
    SELECT
      id,
      organization_id,
      name,
      description,
      icon,
      color,
      show_amount,
      show_category,
      show_payment_date,
      show_reference_number,
      show_payment_method,
      show_payment_status,
      show_currency,
      show_exchange_rate,
      show_invoice_number,
      required_name,
      required_date,
      required_status,
      required_cost_center,
      required_amount,
      required_category,
      required_payment_date,
      required_reference_number,
      required_payment_method,
      required_payment_status,
      required_currency,
      required_exchange_rate,
      required_invoice_number,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_types
    WHERE id = ? AND organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0] ? convertToBoolean(rows[0]) : null;
}

/**
 * Crear un nuevo tipo de egreso
 * @param {Object} expenseTypeData - Datos del tipo de egreso
 */
export async function createExpenseType(expenseTypeData) {
  const sql = `
    INSERT INTO expense_types (
      organization_id,
      name,
      description,
      icon,
      color,
      show_amount,
      show_category,
      show_payment_date,
      show_reference_number,
      show_payment_method,
      show_payment_status,
      show_currency,
      show_exchange_rate,
      show_invoice_number,
      required_name,
      required_date,
      required_status,
      required_cost_center,
      required_amount,
      required_category,
      required_payment_date,
      required_reference_number,
      required_payment_method,
      required_payment_status,
      required_currency,
      required_exchange_rate,
      required_invoice_number,
      is_active,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    expenseTypeData.organization_id,
    expenseTypeData.name,
    expenseTypeData.description || null,
    expenseTypeData.icon || 'dollar-sign',
    expenseTypeData.color || '#EF4444',
    expenseTypeData.show_amount ?? true,
    expenseTypeData.show_category ?? true,
    expenseTypeData.show_payment_date ?? false,
    expenseTypeData.show_reference_number ?? false,
    expenseTypeData.show_payment_method ?? false,
    expenseTypeData.show_payment_status ?? true,
    expenseTypeData.show_currency ?? false,
    expenseTypeData.show_exchange_rate ?? false,
    expenseTypeData.show_invoice_number ?? false,
    expenseTypeData.required_name ?? true,
    expenseTypeData.required_date ?? true,
    expenseTypeData.required_status ?? true,
    expenseTypeData.required_cost_center ?? true,
    expenseTypeData.required_amount ?? false,
    expenseTypeData.required_category ?? false,
    expenseTypeData.required_payment_date ?? false,
    expenseTypeData.required_reference_number ?? false,
    expenseTypeData.required_payment_method ?? false,
    expenseTypeData.required_payment_status ?? false,
    expenseTypeData.required_currency ?? false,
    expenseTypeData.required_exchange_rate ?? false,
    expenseTypeData.required_invoice_number ?? false,
    expenseTypeData.is_active ?? true,
    expenseTypeData.created_by || null
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar un tipo de egreso
 * @param {number} id - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 * @param {Object} expenseTypeData - Datos a actualizar
 */
export async function updateExpenseType(id, organizationId, expenseTypeData) {
    const sql = `
    UPDATE expense_types
    SET
      name = ?,
      description = ?,
      icon = ?,
      color = ?,
      show_amount = ?,
      show_category = ?,
      show_payment_date = ?,
      show_reference_number = ?,
      show_payment_method = ?,
      show_payment_status = ?,
      show_currency = ?,
      show_exchange_rate = ?,
      show_invoice_number = ?,
      required_name = ?,
      required_date = ?,
      required_status = ?,
      required_cost_center = ?,
      required_amount = ?,
      required_category = ?,
      required_payment_date = ?,
      required_reference_number = ?,
      required_payment_method = ?,
      required_payment_status = ?,
      required_currency = ?,
      required_exchange_rate = ?,
      required_invoice_number = ?,
      is_active = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    expenseTypeData.name,
    expenseTypeData.description || null,
    expenseTypeData.icon || 'dollar-sign',
    expenseTypeData.color || '#EF4444',
    expenseTypeData.show_amount ?? true,
    expenseTypeData.show_category ?? true,
    expenseTypeData.show_payment_date ?? false,
    expenseTypeData.show_reference_number ?? false,
    expenseTypeData.show_payment_method ?? false,
    expenseTypeData.show_payment_status ?? true,
    expenseTypeData.show_currency ?? false,
    expenseTypeData.show_exchange_rate ?? false,
    expenseTypeData.show_invoice_number ?? false,
    expenseTypeData.required_name ?? true,
    expenseTypeData.required_date ?? true,
    expenseTypeData.required_status ?? true,
    expenseTypeData.required_cost_center ?? true,
    expenseTypeData.required_amount ?? false,
    expenseTypeData.required_category ?? false,
    expenseTypeData.required_payment_date ?? false,
    expenseTypeData.required_reference_number ?? false,
    expenseTypeData.required_payment_method ?? false,
    expenseTypeData.required_payment_status ?? false,
    expenseTypeData.required_currency ?? false,
    expenseTypeData.required_exchange_rate ?? false,
    expenseTypeData.required_invoice_number ?? false,
    expenseTypeData.is_active ?? true,
    expenseTypeData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar un tipo de egreso (soft delete)
 * @param {number} id - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 */
export async function deleteExpenseType(id, organizationId) {
  const sql = `
    UPDATE expense_types
    SET is_active = FALSE
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Eliminar un tipo de egreso permanentemente
 * NOTA: Esto fallará si hay datos asociados debido a RESTRICT en FK
 * @param {number} id - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 */
export async function hardDeleteExpenseType(id, organizationId) {
  const sql = `
    DELETE FROM expense_types
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Verificar si existe un tipo de egreso con el mismo nombre
 * @param {string} name - Nombre del tipo
 * @param {string} organizationId - ID de la organización
 * @param {number} excludeId - ID a excluir (para updates)
 */
export async function expenseTypeNameExists(name, organizationId, excludeId = null) {
  const sql = `
    SELECT id
    FROM expense_types
    WHERE organization_id = ? AND name = ? ${excludeId ? 'AND id != ?' : ''}
    LIMIT 1
  `;

  const params = excludeId ? [organizationId, name, excludeId] : [organizationId, name];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Contar cuántos egresos están asociados a este tipo
 * @param {number} expenseTypeId - ID del tipo de egreso
 */
export async function countExpensesForType(expenseTypeId) {
  const sql = `
    SELECT COUNT(*) as count
    FROM expenses_data
    WHERE expense_type_id = ?
  `;

  const [rows] = await pool.query(sql, [expenseTypeId]);
  return rows[0].count;
}
