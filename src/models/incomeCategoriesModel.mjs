// src/models/incomeCategoriesModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Get all income categories
 */
export async function getAll(filters = {}) {
  try {
    console.log('📊 IncomeCategoriesModel.getAll - Filters:', filters);
    
    let query = `
      SELECT 
        id,
        categoria,
        active,
        created_at,
        updated_at
      FROM income_categories
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Filter by active status
    if (filters.active !== undefined) {
      query += ` AND active = ?`;
      queryParams.push(filters.active);
    }
    
    // Search filter
    if (filters.search) {
      query += ` AND categoria LIKE ?`;
      queryParams.push(`%${filters.search}%`);
    }
    
    query += ` ORDER BY categoria ASC`;
    
    const [rows] = await pool.query(query, queryParams);
    
    console.log(`✅ IncomeCategoriesModel.getAll - Found ${rows.length} categories`);
    return rows;
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.getAll - Error:', error);
    throw error;
  }
}

/**
 * Get active income categories only
 */
export async function getActive() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        categoria,
        active,
        created_at,
        updated_at
      FROM income_categories 
      WHERE active = TRUE
      ORDER BY categoria ASC
    `);
    
    console.log(`✅ IncomeCategoriesModel.getActive - Found ${rows.length} active categories`);
    return rows;
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.getActive - Error:', error);
    throw error;
  }
}

/**
 * Get income category by ID
 */
export async function getById(id) {
  try {
    console.log(`📊 IncomeCategoriesModel.getById - ID: ${id}`);
    
    const [rows] = await pool.query(`
      SELECT 
        id,
        categoria,
        active,
        created_at,
        updated_at
      FROM income_categories 
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return null;
    }
    
    console.log(`✅ IncomeCategoriesModel.getById - Found category: ${rows[0].categoria}`);
    return rows[0];
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.getById - Error:', error);
    throw error;
  }
}

/**
 * Create new income category
 */
export async function create(categoryData) {
  try {
    console.log('📊 IncomeCategoriesModel.create - Data:', categoryData);
    
    const { categoria, active = true } = categoryData;
    
    // Check if category already exists
    const [existing] = await pool.query(`
      SELECT id FROM income_categories 
      WHERE categoria = ?
    `, [categoria]);
    
    if (existing.length > 0) {
      throw new Error('Ya existe una categoría con este nombre');
    }
    
    const [result] = await pool.query(`
      INSERT INTO income_categories (categoria, active)
      VALUES (?, ?)
    `, [categoria, active]);
    
    const newCategory = await getById(result.insertId);
    
    console.log(`✅ IncomeCategoriesModel.create - Created category with ID: ${result.insertId}`);
    return newCategory;
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.create - Error:', error);
    throw error;
  }
}

/**
 * Update income category
 */
export async function update(id, categoryData) {
  try {
    console.log(`📊 IncomeCategoriesModel.update - ID: ${id}, Data:`, categoryData);
    
    const { categoria, active } = categoryData;
    
    // Check if category exists
    const existing = await getById(id);
    if (!existing) {
      throw new Error('Categoría no encontrada');
    }
    
    // Check if new name already exists (excluding current category)
    if (categoria && categoria !== existing.categoria) {
      const [nameExists] = await pool.query(`
        SELECT id FROM income_categories 
        WHERE categoria = ? AND id != ?
      `, [categoria, id]);
      
      if (nameExists.length > 0) {
        throw new Error('Ya existe una categoría con este nombre');
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    
    if (categoria !== undefined) {
      updates.push('categoria = ?');
      params.push(categoria);
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
      UPDATE income_categories 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, params);
    
    const updatedCategory = await getById(id);
    
    console.log(`✅ IncomeCategoriesModel.update - Updated category: ${updatedCategory.categoria}`);
    return updatedCategory;
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.update - Error:', error);
    throw error;
  }
}

/**
 * Delete income category (soft delete by setting active = false)
 */
export async function deleteCategory(id) {
  try {
    console.log(`📊 IncomeCategoriesModel.delete - ID: ${id}`);
    
    // Check if category exists
    const existing = await getById(id);
    if (!existing) {
      throw new Error('Categoría no encontrada');
    }
    
    // Check if category is being used by any incomes
    const [incomesUsing] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM incomes 
      WHERE category_id = ?
    `, [id]);
    
    if (incomesUsing[0].count > 0) {
      // Soft delete - just deactivate
      await pool.query(`
        UPDATE income_categories 
        SET active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [id]);
      
      console.log(`✅ IncomeCategoriesModel.delete - Category deactivated (soft delete): ${existing.categoria}`);
      return { message: 'Categoría desactivada (está siendo utilizada por ingresos existentes)' };
    } else {
      // Hard delete if not used
      await pool.query(`
        DELETE FROM income_categories 
        WHERE id = ?
      `, [id]);
      
      console.log(`✅ IncomeCategoriesModel.delete - Category deleted: ${existing.categoria}`);
      return { message: 'Categoría eliminada completamente' };
    }
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.delete - Error:', error);
    throw error;
  }
}

/**
 * Get categories usage statistics
 */
export async function getCategoriesUsage() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ic.id,
        ic.categoria,
        ic.active,
        COUNT(i.id) as income_count,
        COALESCE(SUM(i.total_amount), 0) as total_amount
      FROM income_categories ic
      LEFT JOIN incomes i ON ic.id = i.category_id
      GROUP BY ic.id, ic.categoria, ic.active
      ORDER BY ic.categoria ASC
    `);
    
    console.log(`✅ IncomeCategoriesModel.getCategoriesUsage - Found ${rows.length} categories with usage data`);
    return rows;
  } catch (error) {
    console.error('❌ IncomeCategoriesModel.getCategoriesUsage - Error:', error);
    throw error;
  }
}
