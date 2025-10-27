// src/models/incomeTypeModel.mjs
// Modelo para gestión de tipos de ingresos dinámicos

import { pool } from '../config/database.mjs';

/**
 * Convert MySQL TINYINT(1) to JavaScript boolean
 */
function convertToBoolean(row) {
  const booleanFields = [
    'show_amount', 'show_category', 'show_payment_date', 'show_reference_number',
    'show_tax_amount', 'show_net_amount', 'show_total_amount', 'show_payment_method',
    'show_payment_status', 'show_currency', 'show_exchange_rate', 'show_invoice_number',
    'required_name', 'required_date', 'required_status', 'required_cost_center',
    'required_amount', 'required_category', 'required_payment_date', 'required_reference_number',
    'required_tax_amount', 'required_net_amount', 'required_total_amount', 'required_payment_method',
    'required_payment_status', 'required_currency', 'required_exchange_rate', 'required_invoice_number',
    'is_active'
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
 * Obtener todos los tipos de ingresos de una organización
 * @param {string} organizationId - ID de la organización
 * @param {boolean} onlyActive - Si es true, solo devuelve tipos activos
 */
export async function getAllIncomeTypes(organizationId, onlyActive = true) {
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
      show_tax_amount,
      show_net_amount,
      show_total_amount,
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
      required_tax_amount,
      required_net_amount,
      required_total_amount,
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
    FROM income_types
    WHERE organization_id = ?
      ${onlyActive ? 'AND is_active = TRUE' : ''}
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [organizationId]);
  return rows.map(convertToBoolean);
}

/**
 * Obtener un tipo de ingreso por ID
 * @param {number} id - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function getIncomeTypeById(id, organizationId) {
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
      show_tax_amount,
      show_net_amount,
      show_total_amount,
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
      required_tax_amount,
      required_net_amount,
      required_total_amount,
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
    FROM income_types
    WHERE id = ? AND organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0] ? convertToBoolean(rows[0]) : null;
}

/**
 * Crear un nuevo tipo de ingreso
 * @param {Object} incomeTypeData - Datos del tipo de ingreso
 */
export async function createIncomeType(incomeTypeData) {
  const sql = `
    INSERT INTO income_types (
      organization_id,
      name,
      description,
      icon,
      color,
      show_amount,
      show_category,
      show_payment_date,
      show_reference_number,
      show_tax_amount,
      show_net_amount,
      show_total_amount,
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
      required_tax_amount,
      required_net_amount,
      required_total_amount,
      required_payment_method,
      required_payment_status,
      required_currency,
      required_exchange_rate,
      required_invoice_number,
      is_active,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    incomeTypeData.organization_id,
    incomeTypeData.name,
    incomeTypeData.description || null,
    incomeTypeData.icon || 'dollar-sign',
    incomeTypeData.color || '#3B82F6',
    incomeTypeData.show_amount ?? true,
    incomeTypeData.show_category ?? true,
    incomeTypeData.show_payment_date ?? false,
    incomeTypeData.show_reference_number ?? false,
    incomeTypeData.show_tax_amount ?? false,
    incomeTypeData.show_net_amount ?? false,
    incomeTypeData.show_total_amount ?? true,
    incomeTypeData.show_payment_method ?? false,
    incomeTypeData.show_payment_status ?? true,
    incomeTypeData.show_currency ?? false,
    incomeTypeData.show_exchange_rate ?? false,
    incomeTypeData.show_invoice_number ?? false,
    incomeTypeData.required_name ?? true,
    incomeTypeData.required_date ?? true,
    incomeTypeData.required_status ?? true,
    incomeTypeData.required_cost_center ?? true,
    incomeTypeData.required_amount ?? false,
    incomeTypeData.required_category ?? false,
    incomeTypeData.required_payment_date ?? false,
    incomeTypeData.required_reference_number ?? false,
    incomeTypeData.required_tax_amount ?? false,
    incomeTypeData.required_net_amount ?? false,
    incomeTypeData.required_total_amount ?? false,
    incomeTypeData.required_payment_method ?? false,
    incomeTypeData.required_payment_status ?? false,
    incomeTypeData.required_currency ?? false,
    incomeTypeData.required_exchange_rate ?? false,
    incomeTypeData.required_invoice_number ?? false,
    incomeTypeData.is_active ?? true,
    incomeTypeData.created_by || null
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar un tipo de ingreso
 * @param {number} id - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 * @param {Object} incomeTypeData - Datos a actualizar
 */
export async function updateIncomeType(id, organizationId, incomeTypeData) {
  const sql = `
    UPDATE income_types
    SET
      name = ?,
      description = ?,
      icon = ?,
      color = ?,
      show_amount = ?,
      show_category = ?,
      show_payment_date = ?,
      show_reference_number = ?,
      show_tax_amount = ?,
      show_net_amount = ?,
      show_total_amount = ?,
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
      required_tax_amount = ?,
      required_net_amount = ?,
      required_total_amount = ?,
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
    incomeTypeData.name,
    incomeTypeData.description || null,
    incomeTypeData.icon || 'dollar-sign',
    incomeTypeData.color || '#3B82F6',
    incomeTypeData.show_amount ?? true,
    incomeTypeData.show_category ?? true,
    incomeTypeData.show_payment_date ?? false,
    incomeTypeData.show_reference_number ?? false,
    incomeTypeData.show_tax_amount ?? false,
    incomeTypeData.show_net_amount ?? false,
    incomeTypeData.show_total_amount ?? true,
    incomeTypeData.show_payment_method ?? false,
    incomeTypeData.show_payment_status ?? true,
    incomeTypeData.show_currency ?? false,
    incomeTypeData.show_exchange_rate ?? false,
    incomeTypeData.show_invoice_number ?? false,
    incomeTypeData.required_name ?? true,
    incomeTypeData.required_date ?? true,
    incomeTypeData.required_status ?? true,
    incomeTypeData.required_cost_center ?? true,
    incomeTypeData.required_amount ?? false,
    incomeTypeData.required_category ?? false,
    incomeTypeData.required_payment_date ?? false,
    incomeTypeData.required_reference_number ?? false,
    incomeTypeData.required_tax_amount ?? false,
    incomeTypeData.required_net_amount ?? false,
    incomeTypeData.required_total_amount ?? false,
    incomeTypeData.required_payment_method ?? false,
    incomeTypeData.required_payment_status ?? false,
    incomeTypeData.required_currency ?? false,
    incomeTypeData.required_exchange_rate ?? false,
    incomeTypeData.required_invoice_number ?? false,
    incomeTypeData.is_active ?? true,
    incomeTypeData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar un tipo de ingreso (soft delete)
 * @param {number} id - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function deleteIncomeType(id, organizationId) {
  const sql = `
    UPDATE income_types
    SET is_active = FALSE
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Eliminar un tipo de ingreso permanentemente
 * NOTA: Esto fallará si hay datos asociados debido a RESTRICT en FK
 * @param {number} id - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function hardDeleteIncomeType(id, organizationId) {
  const sql = `
    DELETE FROM income_types
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Verificar si existe un tipo de ingreso con el mismo nombre
 * @param {string} name - Nombre del tipo
 * @param {string} organizationId - ID de la organización
 * @param {number} excludeId - ID a excluir (para updates)
 */
export async function incomeTypeNameExists(name, organizationId, excludeId = null) {
  const sql = `
    SELECT id
    FROM income_types
    WHERE organization_id = ? AND name = ? ${excludeId ? 'AND id != ?' : ''}
    LIMIT 1
  `;

  const params = excludeId ? [organizationId, name, excludeId] : [organizationId, name];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Contar cuántos ingresos están asociados a este tipo
 * @param {number} incomeTypeId - ID del tipo de ingreso
 */
export async function countIncomesForType(incomeTypeId) {
  const sql = `
    SELECT COUNT(*) as count
    FROM incomes_data
    WHERE income_type_id = ?
  `;

  const [rows] = await pool.query(sql, [incomeTypeId]);
  return rows[0].count;
}
