// src/models/expenseCategoryModel.mjs
// Modelo para categorías de egresos (específicas por tipo)

import { pool } from '../config/database.mjs';

/**
 * Obtener todas las categorías de un tipo de egreso
 * @param {number} expenseTypeId - ID del tipo de egreso
 * @param {string} organizationId - ID de la organización
 * @param {boolean} onlyActive - Si es true, solo devuelve categorías activas
 */
export async function getCategoriesByType(expenseTypeId, organizationId, onlyActive = true) {
  const sql = `
    SELECT
      id,
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_categories
    WHERE expense_type_id = ? AND organization_id = ?
      ${onlyActive ? 'AND is_active = TRUE' : ''}
    ORDER BY name ASC
  `;

  const [rows] = await pool.query(sql, [expenseTypeId, organizationId]);
  return rows;
}

/**
 * Obtener una categoría por ID
 * @param {number} id - ID de la categoría
 * @param {string} organizationId - ID de la organización
 */
export async function getCategoryById(id, organizationId) {
  const sql = `
    SELECT
      id,
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM expense_categories
    WHERE id = ? AND organization_id = ?
  `;

  const [rows] = await pool.query(sql, [id, organizationId]);
  return rows[0] || null;
}

/**
 * Crear una nueva categoría
 * @param {Object} categoryData - Datos de la categoría
 */
export async function createCategory(categoryData) {
  const sql = `
    INSERT INTO expense_categories (
      expense_type_id,
      organization_id,
      name,
      description,
      color,
      is_active,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    categoryData.expense_type_id,
    categoryData.organization_id,
    categoryData.name,
    categoryData.description || null,
    categoryData.color || '#6B7280',
    categoryData.is_active ?? true,
    categoryData.created_by || null
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Actualizar una categoría
 * @param {number} id - ID de la categoría
 * @param {string} organizationId - ID de la organización
 * @param {Object} categoryData - Datos a actualizar
 */
export async function updateCategory(id, organizationId, categoryData) {
  const sql = `
    UPDATE expense_categories
    SET
      name = ?,
      description = ?,
      color = ?,
      is_active = ?,
      updated_by = ?
    WHERE id = ? AND organization_id = ?
  `;

  const values = [
    categoryData.name,
    categoryData.description || null,
    categoryData.color || '#6B7280',
    categoryData.is_active ?? true,
    categoryData.updated_by || null,
    id,
    organizationId
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
}

/**
 * Eliminar una categoría (soft delete)
 * @param {number} id - ID de la categoría
 * @param {string} organizationId - ID de la organización
 */
export async function deleteCategory(id, organizationId) {
  const sql = `
    UPDATE expense_categories
    SET is_active = FALSE
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Eliminar una categoría permanentemente
 * NOTA: Esto pondrá category_id en NULL en expenses_data (SET NULL FK)
 * @param {number} id - ID de la categoría
 * @param {string} organizationId - ID de la organización
 */
export async function hardDeleteCategory(id, organizationId) {
  const sql = `
    DELETE FROM expense_categories
    WHERE id = ? AND organization_id = ?
  `;

  const [result] = await pool.query(sql, [id, organizationId]);
  return result.affectedRows;
}

/**
 * Verificar si existe una categoría con el mismo nombre en un tipo
 * @param {number} expenseTypeId - ID del tipo de egreso
 * @param {string} name - Nombre de la categoría
 * @param {number} excludeId - ID a excluir (para updates)
 */
export async function categoryNameExistsInType(expenseTypeId, name, excludeId = null) {
  const sql = `
    SELECT id
    FROM expense_categories
    WHERE expense_type_id = ? AND name = ? ${excludeId ? 'AND id != ?' : ''}
    LIMIT 1
  `;

  const params = excludeId ? [expenseTypeId, name, excludeId] : [expenseTypeId, name];
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

/**
 * Contar cuántos egresos usan esta categoría
 * @param {number} categoryId - ID de la categoría
 */
export async function countExpensesForCategory(categoryId) {
  const sql = `
    SELECT COUNT(*) as count
    FROM expenses_data
    WHERE category_id = ?
  `;

  const [rows] = await pool.query(sql, [categoryId]);
  return rows[0].count;
}
