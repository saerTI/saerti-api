// src/models/CC/costoFijoModel.mjs

import { pool } from '../../config/database.mjs';

/**
 * Helper function to get cost center ID by code
 */
async function getCostCenterIdByCode(code) {
  try {
    if (!code || code.trim() === '') return null;
    
    const [rows] = await pool.query(
      'SELECT id FROM cost_centers WHERE code = ? LIMIT 1',
      [code.trim()]
    );
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error(`Error searching cost center with code ${code}:`, error);
    return null;
  }
}

/**
 * Helper function to get account category ID by name
 */
async function getAccountCategoryIdByName(name) {
  try {
    if (!name || name.trim() === '') return null;
    
    const [rows] = await pool.query(
      'SELECT id FROM account_categories WHERE name LIKE ? LIMIT 1',
      [`%${name.trim()}%`]
    );
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error(`Error searching account category with name ${name}:`, error);
    return null;
  }
}

/**
 * Calculate next payment date based on current date and payment cycle
 */
function calculateNextPaymentDate(startDate, paymentDay, paidQuotas) {
  const start = new Date(startDate);
  const nextPayment = new Date(start);
  
  // Add paid quotas (months) + 1 for next payment
  nextPayment.setMonth(start.getMonth() + paidQuotas + 1);
  nextPayment.setDate(paymentDay);
  
  return nextPayment.toISOString().split('T')[0];
}

/**
 * Gets all fixed costs with filters, search and pagination
 */
async function getAll(filters = {}, pagination = {}) {
  try {
    const limit = parseInt(pagination.limit) || 50;
    const offset = parseInt(pagination.offset) || 0;
    const page = Math.floor(offset / limit) + 1;
    
    let baseQuery = `
      FROM fixed_costs fc
      LEFT JOIN cost_centers cc ON fc.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON fc.account_category_id = ac.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Search filter
    if (filters.search && filters.search.trim()) {
      baseQuery += ' AND (fc.name LIKE ? OR fc.description LIKE ?)';
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    // State filter
    if (filters.state) {
      baseQuery += ' AND fc.state = ?';
      queryParams.push(filters.state);
    }
    
    // Cost center filter
    if (filters.costCenterId) {
      baseQuery += ' AND fc.cost_center_id = ?';
      queryParams.push(filters.costCenterId);
    }
    
    // Category filter
    if (filters.categoryId) {
      baseQuery += ' AND fc.account_category_id = ?';
      queryParams.push(filters.categoryId);
    }
    
    // Date filters
    if (filters.startDate) {
      baseQuery += ' AND fc.start_date >= ?';
      queryParams.push(filters.startDate);
    }
    if (filters.endDate) {
      baseQuery += ' AND fc.end_date <= ?';
      queryParams.push(filters.endDate);
    }
    
    // Payment status filter
    if (filters.paymentStatus) {
      if (filters.paymentStatus === 'completed') {
        baseQuery += ' AND fc.paid_quotas >= fc.quota_count';
      } else if (filters.paymentStatus === 'active') {
        baseQuery += ' AND fc.paid_quotas < fc.quota_count';
      }
    }
    
    // Data query with all fields
    const dataQuery = `
      SELECT 
        fc.*, 
        cc.code as center_code, 
        cc.name as center_name,
        cc.type as center_type,
        ac.name as category_name,
        ac.code as category_code,
        ROUND(fc.quota_value * fc.quota_count, 2) as total_amount,
        ROUND(fc.quota_value * fc.paid_quotas, 2) as paid_amount,
        ROUND(fc.quota_value * (fc.quota_count - fc.paid_quotas), 2) as remaining_amount,
        CASE 
          WHEN fc.paid_quotas >= fc.quota_count THEN 'completed'
          WHEN fc.next_payment_date < CURDATE() THEN 'overdue'
          ELSE 'active'
        END as payment_status
      ${baseQuery}
      ORDER BY fc.next_payment_date ASC, fc.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT fc.id) as total
      ${baseQuery}
    `;
    
    // Execute count
    const [countResult] = await pool.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;
    
    if (total === 0) {
      return {
        data: [],
        pagination: {
          current_page: 1, per_page: limit, total: 0, total_pages: 0,
          has_next: false, has_prev: false
        }
      };
    }
    
    // Execute data query
    const dataParams = [...queryParams, limit, offset];
    const [rows] = await pool.query(dataQuery, dataParams);
    
    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: rows || [],
      pagination: {
        current_page: page,
        per_page: limit,
        total: total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
    
  } catch (error) {
    console.error('❌ Error in getAll fixed costs:', error);
    throw error;
  }
}

/**
 * Gets a fixed cost by ID with related information
 */
async function getById(id) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        fc.*, 
        cc.code as center_code, 
        cc.name as center_name,
        cc.type as center_type,
        ac.name as category_name,
        ac.code as category_code,
        ROUND(fc.quota_value * fc.quota_count, 2) as total_amount,
        ROUND(fc.quota_value * fc.paid_quotas, 2) as paid_amount,
        ROUND(fc.quota_value * (fc.quota_count - fc.paid_quotas), 2) as remaining_amount
      FROM fixed_costs fc
      LEFT JOIN cost_centers cc ON fc.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON fc.account_category_id = ac.id
      WHERE fc.id = ?
    `, [id]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting fixed cost by ID:', error);
    throw error;
  }
}

/**
 * Creates a new fixed cost
 */
async function create(fixedCostData) {
  try {
    console.log('📋 Creating fixed cost:', fixedCostData);
    
    // Map cost center if provided by code
    let costCenterId = fixedCostData.cost_center_id;
    if (!costCenterId && fixedCostData.center_code) {
      costCenterId = await getCostCenterIdByCode(fixedCostData.center_code);
    }
    
    // Map account category if provided by name
    let accountCategoryId = fixedCostData.account_category_id;
    if (!accountCategoryId && fixedCostData.category_name) {
      accountCategoryId = await getAccountCategoryIdByName(fixedCostData.category_name);
    }
    
    // Ensure cost_center_id is not null
    if (!costCenterId) {
      // Try to get default cost center
      const [defaultCenter] = await pool.query(
        'SELECT id FROM cost_centers WHERE code = ? LIMIT 1',
        ['001-0']
      );
      
      if (defaultCenter.length > 0) {
        costCenterId = defaultCenter[0].id;
      } else {
        throw new Error('cost_center_id cannot be null - no valid cost center found');
      }
    }
    
    // Calculate end date if not provided
    let endDate = fixedCostData.end_date;
    if (!endDate && fixedCostData.start_date && fixedCostData.quota_count) {
      const start = new Date(fixedCostData.start_date);
      const end = new Date(start);
      end.setMonth(start.getMonth() + parseInt(fixedCostData.quota_count));
      endDate = end.toISOString().split('T')[0];
    }
    
    // Calculate next payment date
    const paymentDay = new Date(fixedCostData.payment_date || fixedCostData.start_date).getDate();
    const nextPaymentDate = calculateNextPaymentDate(
      fixedCostData.start_date,
      paymentDay,
      fixedCostData.paid_quotas || 0
    );
    
    const finalData = {
      name: fixedCostData.name,
      description: fixedCostData.description || null,
      quota_value: parseFloat(fixedCostData.quota_value),
      quota_count: parseInt(fixedCostData.quota_count),
      paid_quotas: parseInt(fixedCostData.paid_quotas) || 0,
      start_date: fixedCostData.start_date,
      end_date: endDate,
      payment_date: fixedCostData.payment_date || fixedCostData.start_date,
      next_payment_date: nextPaymentDate,
      cost_center_id: costCenterId,
      account_category_id: accountCategoryId,
      company_id: fixedCostData.company_id || 1,
      state: fixedCostData.state || 'active'
    };
    
    console.log('📋 Final data for insert:', finalData);
    
    const [result] = await pool.query(`
      INSERT INTO fixed_costs (
        name, description, quota_value, quota_count, paid_quotas,
        start_date, end_date, payment_date, next_payment_date,
        cost_center_id, account_category_id, company_id, state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalData.name, finalData.description, finalData.quota_value,
      finalData.quota_count, finalData.paid_quotas, finalData.start_date,
      finalData.end_date, finalData.payment_date, finalData.next_payment_date,
      finalData.cost_center_id, finalData.account_category_id,
      finalData.company_id, finalData.state
    ]);
    
    const insertedId = result.insertId;
    console.log('✅ Fixed cost created with ID:', insertedId);
    
    return { 
      id: insertedId,
      ...finalData,
      isUpdate: false
    };
    
  } catch (error) {
    console.error('❌ Error creating fixed cost:', error);
    throw error;
  }
}

/**
 * Updates an existing fixed cost
 */
async function update(id, fixedCostData) {
  try {
    // Get current data
    const current = await getById(id);
    if (!current) {
      throw new Error('Fixed cost not found');
    }
    
    // Map cost center if provided by code
    let costCenterId = fixedCostData.cost_center_id || current.cost_center_id;
    if (fixedCostData.center_code) {
      costCenterId = await getCostCenterIdByCode(fixedCostData.center_code);
    }
    
    // Map account category if provided by name  
    let accountCategoryId = fixedCostData.account_category_id || current.account_category_id;
    if (fixedCostData.category_name) {
      accountCategoryId = await getAccountCategoryIdByName(fixedCostData.category_name);
    }
    
    // Recalculate next payment date if paid_quotas changed
    let nextPaymentDate = current.next_payment_date;
    if (fixedCostData.paid_quotas !== undefined && 
        fixedCostData.paid_quotas !== current.paid_quotas) {
      const paymentDay = new Date(current.payment_date).getDate();
      nextPaymentDate = calculateNextPaymentDate(
        current.start_date,
        paymentDay,
        parseInt(fixedCostData.paid_quotas)
      );
    }
    
    const updateData = {
      name: fixedCostData.name || current.name,
      description: fixedCostData.description !== undefined ? fixedCostData.description : current.description,
      quota_value: fixedCostData.quota_value !== undefined ? parseFloat(fixedCostData.quota_value) : current.quota_value,
      quota_count: fixedCostData.quota_count !== undefined ? parseInt(fixedCostData.quota_count) : current.quota_count,
      paid_quotas: fixedCostData.paid_quotas !== undefined ? parseInt(fixedCostData.paid_quotas) : current.paid_quotas,
      start_date: fixedCostData.start_date || current.start_date,
      end_date: fixedCostData.end_date || current.end_date,
      payment_date: fixedCostData.payment_date || current.payment_date,
      next_payment_date: nextPaymentDate,
      cost_center_id: costCenterId,
      account_category_id: accountCategoryId,
      state: fixedCostData.state || current.state
    };
    
    await pool.query(`
      UPDATE fixed_costs SET
        name = ?, description = ?, quota_value = ?, quota_count = ?, paid_quotas = ?,
        start_date = ?, end_date = ?, payment_date = ?, next_payment_date = ?,
        cost_center_id = ?, account_category_id = ?, state = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updateData.name, updateData.description, updateData.quota_value,
      updateData.quota_count, updateData.paid_quotas, updateData.start_date,
      updateData.end_date, updateData.payment_date, updateData.next_payment_date,
      updateData.cost_center_id, updateData.account_category_id, updateData.state,
      id
    ]);
    
    return updateData;
    
  } catch (error) {
    console.error('❌ Error updating fixed cost:', error);
    throw error;
  }
}

/**
 * Deletes a fixed cost
 */
async function deleteFixedCost(id) {
  try {
    const [result] = await pool.query('DELETE FROM fixed_costs WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error deleting fixed cost:', error);
    throw error;
  }
}

/**
 * Gets fixed costs statistics
 */
async function getStats(filters = {}) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN fc.state = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN fc.state = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN fc.state = 'suspended' THEN 1 ELSE 0 END) as suspended,
        SUM(CASE WHEN fc.state = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN fc.state = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(fc.quota_value * fc.quota_count) as total_amount,
        SUM(fc.quota_value * fc.paid_quotas) as paid_amount,
        SUM(fc.quota_value * (fc.quota_count - fc.paid_quotas)) as remaining_amount,
        AVG(fc.quota_value) as avg_quota_value
      FROM fixed_costs fc
      LEFT JOIN cost_centers cc ON fc.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON fc.account_category_id = ac.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Apply same filters as getAll
    if (filters.search && filters.search.trim()) {
      query += ' AND (fc.name LIKE ? OR fc.description LIKE ?)';
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    if (filters.state) {
      query += ' AND fc.state = ?';
      queryParams.push(filters.state);
    }
    
    if (filters.costCenterId) {
      query += ' AND fc.cost_center_id = ?';
      queryParams.push(filters.costCenterId);
    }
    
    const [rows] = await pool.query(query, queryParams);
    
    return rows[0] || {
      total: 0, draft: 0, active: 0, suspended: 0, completed: 0, cancelled: 0,
      total_amount: 0, paid_amount: 0, remaining_amount: 0, avg_quota_value: 0
    };
    
  } catch (error) {
    console.error('❌ Error getting fixed costs statistics:', error);
    throw error;
  }
}

/**
 * Gets fixed costs by cost center
 */
async function getByCostCenter(costCenterId, options = {}) {
  try {
    const limit = options.limit || 100;
    const state = options.state;
    
    let query = `
      SELECT 
        fc.*, 
        cc.code as center_code, 
        cc.name as center_name,
        ac.name as category_name
      FROM fixed_costs fc
      LEFT JOIN cost_centers cc ON fc.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON fc.account_category_id = ac.id
      WHERE fc.cost_center_id = ?
    `;
    
    let queryParams = [costCenterId];
    
    if (state) {
      query += ' AND fc.state = ?';
      queryParams.push(state);
    }
    
    query += ' ORDER BY fc.next_payment_date ASC LIMIT ?';
    queryParams.push(limit);
    
    const [rows] = await pool.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('Error getting fixed costs by cost center:', error);
    throw error;
  }
}

/**
 * Update paid quotas for a fixed cost
 */
async function updatePaidQuotas(id, paidQuotas) {
  try {
    const current = await getById(id);
    if (!current) {
      throw new Error('Fixed cost not found');
    }
    
    // Recalculate next payment date
    const paymentDay = new Date(current.payment_date).getDate();
    const nextPaymentDate = calculateNextPaymentDate(
      current.start_date,
      paymentDay,
      parseInt(paidQuotas)
    );
    
    // Auto-complete if all quotas are paid
    let newState = current.state;
    if (parseInt(paidQuotas) >= current.quota_count && current.state === 'active') {
      newState = 'completed';
    }
    
    await pool.query(`
      UPDATE fixed_costs SET
        paid_quotas = ?,
        next_payment_date = ?,
        state = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paidQuotas, nextPaymentDate, newState, id]);
    
    return true;
  } catch (error) {
    console.error('Error updating paid quotas:', error);
    throw error;
  }
}

export {
  getAll,
  getById,
  create,
  update,
  deleteFixedCost as delete,
  getStats,
  getByCostCenter,
  updatePaidQuotas,
  getCostCenterIdByCode,
  getAccountCategoryIdByName
};