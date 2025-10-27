// src/models/expenseStatusModel.mjs
// Modelo para estados de egresos (específicos por tipo)

import { pool } from '../config/database.mjs';

/**
 * Obtener todos los estados de un tipo de egreso
 * @param {number} expenseTypeId - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 * @param {boolean} onlyActive - Si es true, solo devuelve estados activos
 */
export async function getStatusesByType(expenseTypeId, organizationId, onlyActive = true) {
  const sql = `
    SELECT
      id,
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_statuses
    WHERE expense_type_id = ? AND organization_id = ?
      ${onlyActive ? 'AND is_active = TRUE' : ''}
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [expenseTypeId, organizationId]);
  return rows;
}

/**
 * Obtener un estado por ID
 * @param {number} id - ID del estado
 * @param {string} organizationId - ID de la organización
 */
export async function getStatusById(id, organizationId) {
  const sql = `
    SELECT
      id,
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_statuses
    WHERE id = ? AND organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0] || null;
}

/**
 * Crear un nuevo estado
 * @param {Object} statusData - Datos del estado
 */
export async function createStatus(statusData) {
  const sql = `
    INSERT INTO expense_statuses (
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    statusData.expense_type_id,
    statusData.organization_id,
    statusData.name,
    statusData.description || null,
    statusData.color || '#6B7280',
    statusData.is_final ?? false,
    statusData.is_active ?? true,
    statusData.created_by || null
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar un estado
 * @param {number} id - ID del estado
 * @param {string} organizationId - ID de la organización
 * @param {Object} statusData - Datos a actualizar
 */
export async function updateStatus(id, organizationId, statusData) {
  const sql = `
    UPDATE expense_statuses
    SET
      name = ?,
      description = ?,
      color = ?,
      is_final = ?,
      is_active = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    statusData.name,
    statusData.description || null,
    statusData.color || '#6B7280',
    statusData.is_final ?? false,
    statusData.is_active ?? true,
    statusData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar un estado (soft delete)
 * @param {number} id - ID del estado
 * @param {string} organizationId - ID de la organización
 */
export async function deleteStatus(id, organizationId) {
  const sql = `
    UPDATE expense_statuses
    SET is_active = FALSE
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Eliminar un estado permanentemente
 * NOTA: Esto fallará si hay egresos con este estado (RESTRICT FK)
 * @param {number} id - ID del estado
 * @param {string} organizationId - ID de la organización
 */
export async function hardDeleteStatus(id, organizationId) {
  const sql = `
    DELETE FROM expense_statuses
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Verificar si existe un estado con el mismo nombre en un tipo
 * @param {number} expenseTypeId - ID del tipo de egreso
 * @param {string} name - Nombre del estado
 * @param {number} excludeId - ID a excluir (para updates)
 */
export async function statusNameExistsInType(expenseTypeId, name, excludeId = null) {
  const sql = `
    SELECT id
    FROM expense_statuses
    WHERE expense_type_id = ? AND name = ? ${excludeId ? 'AND id != ?' : ''}
    LIMIT 1
  `;

  const params = excludeId ? [expenseTypeId, name, excludeId] : [expenseTypeId, name];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Contar cuántos egresos tienen este estado
 * @param {number} statusId - ID del estado
 */
export async function countExpensesForStatus(statusId) {
  const sql = `
    SELECT COUNT(*) as count
    FROM expenses_data
    WHERE status_id = ?
  `;

  const [rows] = await pool.query(sql, [statusId]);
  return rows[0].count;
}

/**
 * Obtener estados finales de un tipo
 * @param {number} expenseTypeId - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 */
export async function getFinalStatusesByType(expenseTypeId, organizationId) {
  const sql = `
    SELECT
      id,
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_statuses
    WHERE expense_type_id = ? AND organization_id = ? AND is_final = TRUE AND is_active = TRUE
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [expenseTypeId, organizationId]);
  return rows;
}
