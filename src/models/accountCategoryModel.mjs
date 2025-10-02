// src/models/accountCategoryModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Get all account categories
 */
export async function getAll(filters = {}) {
  try {
    console.log('📊 AccountCategoryModel.getAll - Filters:', filters);

    let query = `
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE 1=1
    `;

    let queryParams = [];

    // Filter by active status
    if (filters.active !== undefined) {
      query += ` AND active = ?`;
      queryParams.push(filters.active);
    }

    // Filter by type
    if (filters.type) {
      query += ` AND type = ?`;
      queryParams.push(filters.type);
    }

    // Filter by group_name
    if (filters.group_name) {
      query += ` AND group_name = ?`;
      queryParams.push(filters.group_name);
    }

    // Search filter
    if (filters.search) {
      query += ` AND (name LIKE ? OR code LIKE ?)`;
      queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY type, group_name, code ASC`;

    const [rows] = await pool.query(query, queryParams);

    console.log(`✅ AccountCategoryModel.getAll - Found ${rows.length} categories`);
    return rows;
  } catch (error) {
    console.error('❌ AccountCategoryModel.getAll - Error:', error);
    throw error;
  }
}

/**
 * Get active account categories only
 */
export async function getActive() {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE active = TRUE
      ORDER BY type, group_name, code ASC
    `);

    console.log(`✅ AccountCategoryModel.getActive - Found ${rows.length} active categories`);
    return rows;
  } catch (error) {
    console.error('❌ AccountCategoryModel.getActive - Error:', error);
    throw error;
  }
}

/**
 * Get account category by ID
 */
export async function getById(id) {
  try {
    console.log(`📊 AccountCategoryModel.getById - ID: ${id}`);

    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE id = ?
    `, [id]);

    if (rows.length === 0) {
      return null;
    }

    console.log(`✅ AccountCategoryModel.getById - Found category: ${rows[0].name}`);
    return rows[0];
  } catch (error) {
    console.error('❌ AccountCategoryModel.getById - Error:', error);
    throw error;
  }
}

/**
 * Get account category by code
 */
export async function getByCode(code) {
  try {
    console.log(`📊 AccountCategoryModel.getByCode - Code: ${code}`);

    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE code = ?
    `, [code]);

    if (rows.length === 0) {
      return null;
    }

    console.log(`✅ AccountCategoryModel.getByCode - Found category: ${rows[0].name}`);
    return rows[0];
  } catch (error) {
    console.error('❌ AccountCategoryModel.getByCode - Error:', error);
    throw error;
  }
}

/**
 * Create new account category
 */
export async function create(categoryData) {
  try {
    console.log('📊 AccountCategoryModel.create - Data:', categoryData);

    const {
      code,
      name,
      type = 'gastos_generales',
      group_name = null,
      active = true
    } = categoryData;

    // Check if code already exists
    const [existing] = await pool.query(`
      SELECT id FROM account_categories
      WHERE code = ?
    `, [code]);

    if (existing.length > 0) {
      throw new Error('Ya existe una categoría con este código');
    }

    const [result] = await pool.query(`
      INSERT INTO account_categories (code, name, type, group_name, active)
      VALUES (?, ?, ?, ?, ?)
    `, [code, name, type, group_name, active]);

    const newCategory = await getById(result.insertId);

    console.log(`✅ AccountCategoryModel.create - Created category with ID: ${result.insertId}`);
    return newCategory;
  } catch (error) {
    console.error('❌ AccountCategoryModel.create - Error:', error);
    throw error;
  }
}

/**
 * Update account category
 */
export async function update(id, categoryData) {
  try {
    console.log(`📊 AccountCategoryModel.update - ID: ${id}, Data:`, categoryData);

    const { code, name, type, group_name, active } = categoryData;

    // Check if category exists
    const existing = await getById(id);
    if (!existing) {
      throw new Error('Categoría no encontrada');
    }

    // Check if new code already exists (excluding current category)
    if (code && code !== existing.code) {
      const [codeExists] = await pool.query(`
        SELECT id FROM account_categories
        WHERE code = ? AND id != ?
      `, [code, id]);

      if (codeExists.length > 0) {
        throw new Error('Ya existe una categoría con este código');
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (code !== undefined) {
      updates.push('code = ?');
      params.push(code);
    }

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }

    if (group_name !== undefined) {
      updates.push('group_name = ?');
      params.push(group_name);
    }

    if (active !== undefined) {
      updates.push('active = ?');
      params.push(active);
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    params.push(id);

    await pool.query(`
      UPDATE account_categories
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, params);

    const updatedCategory = await getById(id);

    console.log(`✅ AccountCategoryModel.update - Updated category: ${updatedCategory.name}`);
    return updatedCategory;
  } catch (error) {
    console.error('❌ AccountCategoryModel.update - Error:', error);
    throw error;
  }
}

/**
 * Delete account category (soft delete by setting active = false)
 */
export async function deleteCategory(id) {
  try {
    console.log(`📊 AccountCategoryModel.delete - ID: ${id}`);

    // Check if category exists
    const existing = await getById(id);
    if (!existing) {
      throw new Error('Categoría no encontrada');
    }

    // Check if category is being used by any related records
    // This would depend on your other tables that reference account_categories
    // For now, we'll do a soft delete

    await pool.query(`
      UPDATE account_categories
      SET active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    console.log(`✅ AccountCategoryModel.delete - Category deactivated: ${existing.name}`);
    return { message: 'Categoría desactivada' };
  } catch (error) {
    console.error('❌ AccountCategoryModel.delete - Error:', error);
    throw error;
  }
}

/**
 * Get categories grouped by type
 */
export async function getGroupedByType() {
  try {
    const [rows] = await pool.query(`
      SELECT
        type,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT group_name ORDER BY group_name) as groups
      FROM account_categories
      WHERE active = TRUE
      GROUP BY type
      ORDER BY type
    `);

    console.log(`✅ AccountCategoryModel.getGroupedByType - Found ${rows.length} types`);
    return rows;
  } catch (error) {
    console.error('❌ AccountCategoryModel.getGroupedByType - Error:', error);
    throw error;
  }
}

/**
 * Get categories by type
 */
export async function getByType(type) {
  try {
    console.log(`📊 AccountCategoryModel.getByType - Type: ${type}`);

    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE type = ? AND active = TRUE
      ORDER BY group_name, code ASC
    `, [type]);

    console.log(`✅ AccountCategoryModel.getByType - Found ${rows.length} categories for type: ${type}`);
    return rows;
  } catch (error) {
    console.error('❌ AccountCategoryModel.getByType - Error:', error);
    throw error;
  }
}

/**
 * Get categories by group name
 */
export async function getByGroupName(groupName) {
  try {
    console.log(`📊 AccountCategoryModel.getByGroupName - Group: ${groupName}`);

    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        type,
        group_name,
        active,
        created_at,
        updated_at
      FROM account_categories
      WHERE group_name = ? AND active = TRUE
      ORDER BY code ASC
    `, [groupName]);

    console.log(`✅ AccountCategoryModel.getByGroupName - Found ${rows.length} categories for group: ${groupName}`);
    return rows;
  } catch (error) {
    console.error('❌ AccountCategoryModel.getByGroupName - Error:', error);
    throw error;
  }
}