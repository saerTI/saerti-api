// src/models/costCenterModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Get all cost centers for an organization
 */
export async function getAllCostCenters(organizationId) {
  const sql = `
    SELECT
      id,
      code,
      name,
      description,
      active,
      organization_id,
      created_at,
      updated_at
    FROM cost_centers
    WHERE organization_id = ?
    ORDER BY code ASC
  `;

  const [rows] = await pool.query(sql, [organizationId]);
  return rows;
}

/**
 * Get cost center by ID
 */
export async function getCostCenterById(id, organizationId) {
  const sql = `
    SELECT
      id,
      code,
      name,
      description,
      active,
      organization_id,
      created_at,
      updated_at
    FROM cost_centers
    WHERE id = ? AND organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0];
}

/**
 * Create a new cost center
 */
export async function createCostCenter(data) {
  const sql = `
    INSERT INTO cost_centers (
      code,
      name,
      description,
      active,
      organization_id,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;

  const [result] = await pool.query(sql, [
    data.code,
    data.name,
    data.description || null,
    data.active !== false ? 1 : 0,
    data.organization_id,
    data.created_by
  ]);

  return result.insertId;
}

/**
 * Update cost center
 */
export async function updateCostCenter(id, organizationId, data) {
  const sql = `
    UPDATE cost_centers
    SET
      code = ?,
      name = ?,
      description = ?,
      active = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [
    data.code,
    data.name,
    data.description || null,
    data.active !== false ? 1 : 0,
    data.updated_by,
    id,
    organizationId
  ]);

  return result.affectedRows;
}

/**
 * Delete cost center (soft delete by setting active = 0)
 */
export async function deleteCostCenter(id, organizationId) {
  const sql = `
    UPDATE cost_centers
    SET active = 0
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}
