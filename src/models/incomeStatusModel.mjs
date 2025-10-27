// src/models/incomeStatusModel.mjs
// Modelo para estados de ingresos (específicos por tipo)

import { pool } from '../config/database.mjs';

/**
 * Obtener todos los estados de un tipo de ingreso
 * @param {number} incomeTypeId - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 * @param {boolean} onlyActive - Si es true, solo devuelve estados activos
 */
export async function getStatusesByType(incomeTypeId, organizationId, onlyActive = true) {
  const sql = `
    SELECT
      id,
      income_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_at,
      updated_at
    FROM income_statuses
    WHERE income_type_id = ? AND organization_id = ?
      ${onlyActive ? 'AND is_active = TRUE' : ''}
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [incomeTypeId, organizationId]);
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
      income_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_at,
      updated_at
    FROM income_statuses
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
    INSERT INTO income_statuses (
      income_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    statusData.income_type_id,
    statusData.organization_id,
    statusData.name,
    statusData.description || null,
    statusData.color || '#6B7280',
    statusData.is_final ?? false,
    statusData.is_active ?? true
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
    UPDATE income_statuses
    SET
      name = ?,
      description = ?,
      color = ?,
      is_final = ?,
      is_active = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    statusData.name,
    statusData.description || null,
    statusData.color || '#6B7280',
    statusData.is_final ?? false,
    statusData.is_active ?? true,
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
    UPDATE income_statuses
    SET is_active = FALSE
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Eliminar un estado permanentemente
 * NOTA: Esto fallará si hay ingresos con este estado (RESTRICT FK)
 * @param {number} id - ID del estado
 * @param {string} organizationId - ID de la organización
 */
export async function hardDeleteStatus(id, organizationId) {
  const sql = `
    DELETE FROM income_statuses
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Verificar si existe un estado con el mismo nombre en un tipo
 * @param {number} incomeTypeId - ID del tipo de ingreso
 * @param {string} name - Nombre del estado
 * @param {number} excludeId - ID a excluir (para updates)
 */
export async function statusNameExistsInType(incomeTypeId, name, excludeId = null) {
  const sql = `
    SELECT id
    FROM income_statuses
    WHERE income_type_id = ? AND name = ? ${excludeId ? 'AND id != ?' : ''}
    LIMIT 1
  `;

  const params = excludeId ? [incomeTypeId, name, excludeId] : [incomeTypeId, name];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Contar cuántos ingresos tienen este estado
 * @param {number} statusId - ID del estado
 */
export async function countIncomesForStatus(statusId) {
  const sql = `
    SELECT COUNT(*) as count
    FROM incomes_data
    WHERE status_id = ?
  `;

  const [rows] = await pool.query(sql, [statusId]);
  return rows[0].count;
}

/**
 * Obtener estados finales de un tipo
 * @param {number} incomeTypeId - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 */
export async function getFinalStatusesByType(incomeTypeId, organizationId) {
  const sql = `
    SELECT
      id,
      income_type_id,
      organization_id,
      name,
      description,
      color,
      is_final,
      is_active,
      created_at,
      updated_at
    FROM income_statuses
    WHERE income_type_id = ? AND organization_id = ? AND is_final = TRUE AND is_active = TRUE
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [incomeTypeId, organizationId]);
  return rows;
}
