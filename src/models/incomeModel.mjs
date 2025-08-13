// src/models/CC/incomeModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Get all incomes with filters and pagination
 */
export async function getAll(filters = {}, pagination = {}) {
  try {
    console.log('📊 IncomeModel.getAll - Filters:', filters);
    console.log('📊 IncomeModel.getAll - Pagination:', pagination);
    
    // ✅ BASE QUERY WITH JOINS
    let baseQuery = `
      FROM incomes i
      LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // ✅ DYNAMIC FILTERS
    if (filters.search) {
      baseQuery += ` AND (
        i.document_number LIKE ? OR
        i.client_name LIKE ? OR
        i.client_tax_id LIKE ? OR
        i.ep_detail LIKE ? OR
        cc.name LIKE ? OR
        cc.code LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.state) {
      baseQuery += ` AND i.state = ?`;
      queryParams.push(filters.state);
    }
    
    if (filters.costCenterId) {
      baseQuery += ` AND i.cost_center_id = ?`;
      queryParams.push(filters.costCenterId);
    }
    
    if (filters.clientId) {
      baseQuery += ` AND i.client_tax_id = ?`;
      queryParams.push(filters.clientId);
    }
    
    if (filters.startDate) {
      baseQuery += ` AND i.date >= ?`;
      queryParams.push(filters.startDate);
    }
    
    if (filters.endDate) {
      baseQuery += ` AND i.date <= ?`;
      queryParams.push(filters.endDate);
    }
    
    if (filters.minAmount) {
      baseQuery += ` AND i.ep_total >= ?`;
      queryParams.push(filters.minAmount);
    }
    
    if (filters.maxAmount) {
      baseQuery += ` AND i.ep_total <= ?`;
      queryParams.push(filters.maxAmount);
    }
    
    if (filters.paymentType) {
      if (filters.paymentType === 'factoring') {
        baseQuery += ` AND i.factoring IS NOT NULL AND i.factoring != ''`;
      } else {
        baseQuery += ` AND (i.factoring IS NULL OR i.factoring = '')`;
      }
    }
    
    if (filters.factoring) {
      baseQuery += ` AND i.factoring = ?`;
      queryParams.push(filters.factoring);
    }
    
    // ✅ GET TOTAL COUNT
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total ${baseQuery}`,
      queryParams
    );
    const total = countResult[0].total;
    
    // ✅ GET PAGINATED DATA
    const selectQuery = `
      SELECT 
        i.*,
        cc.code as cost_center_code,
        cc.name as center_name,
        cc.description as project_name
      ${baseQuery}
      ORDER BY i.date DESC, i.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await pool.query(
      selectQuery,
      [...queryParams, pagination.limit, pagination.offset]
    );
    
    // ✅ CALCULATE PAGINATION
    const totalPages = Math.ceil(total / pagination.limit);
    const currentPage = pagination.page;
    
    const paginationInfo = {
      current_page: currentPage,
      per_page: pagination.limit,
      total: total,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_prev: currentPage > 1,
      from: pagination.offset + 1,
      to: Math.min(pagination.offset + pagination.limit, total)
    };
    
    console.log('✅ Query executed successfully. Found:', rows.length, 'records');
    
    return {
      data: rows,
      pagination: paginationInfo
    };
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.getAll:', error);
    throw error;
  }
}

/**
 * Get income by ID
 */
export async function getById(id) {
  try {
    console.log('🔍 IncomeModel.getById:', id);
    
    const [rows] = await pool.query(`
      SELECT 
        i.*,
        cc.id as cost_center_id,
        cc.code as cost_center_code,
        cc.name as center_name,
        cc.description as project_name
      FROM incomes i
      LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
      WHERE i.id = ?
    `, [id]);
    
    return rows[0] || null;
  } catch (error) {
    console.error('❌ Error in IncomeModel.getById:', error);
    throw error;
  }
}

/**
 * Create new income
 */
export async function create(incomeData) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    console.log('💾 IncomeModel.create:', incomeData);
    
    // ✅ RESOLVE COST CENTER
    let costCenterId = null;
    if (incomeData.cost_center_code) {
      const [centerRows] = await connection.query(
        'SELECT id FROM cost_centers WHERE code = ? AND active = TRUE',
        [incomeData.cost_center_code]
      );
      
      if (centerRows.length > 0) {
        costCenterId = centerRows[0].id;
        console.log('✅ Found cost center:', costCenterId, 'for code:', incomeData.cost_center_code);
      } else {
        console.log('⚠️ Cost center not found for code:', incomeData.cost_center_code);
      }
    }
    
    // ✅ CHECK FOR EXISTING INCOME (by document_number)
    const [existingRows] = await connection.query(
      'SELECT id FROM incomes WHERE document_number = ?',
      [incomeData.document_number]
    );
    
    let result;
    let isUpdate = false;
    
    if (existingRows.length > 0) {
      // UPDATE EXISTING
      const existingId = existingRows[0].id;
      console.log('📝 Updating existing income:', existingId);
      
      const updateFields = [];
      const updateValues = [];
      
      // Build dynamic update query
      Object.keys(incomeData).forEach(key => {
        if (key !== 'document_number' && incomeData[key] !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(incomeData[key]);
        }
      });
      
      if (costCenterId) {
        updateFields.push('cost_center_id = ?');
        updateValues.push(costCenterId);
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(existingId);
      
      const updateQuery = `
        UPDATE incomes 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      
      await connection.query(updateQuery, updateValues);
      
      result = await getById(existingId);
      result.id = existingId;
      isUpdate = true;
      
    } else {
      // CREATE NEW
      console.log('➕ Creating new income');
      
      const insertData = {
        ...incomeData,
        cost_center_id: costCenterId
      };
      
      const fields = Object.keys(insertData).join(', ');
      const placeholders = Object.keys(insertData).map(() => '?').join(', ');
      const values = Object.values(insertData);
      
      const insertQuery = `
        INSERT INTO incomes (${fields}) 
        VALUES (${placeholders})
      `;
      
      const [insertResult] = await connection.query(insertQuery, values);
      result = await getById(insertResult.insertId);
      result.id = insertResult.insertId;
    }
    
    await connection.commit();
    console.log('✅ Income processed successfully:', result.id);
    
    return {
      ...result,
      isUpdate
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error in IncomeModel.create:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update income
 */
export async function update(id, updateData) {
  try {
    console.log('📝 IncomeModel.update:', id, updateData);
    
    // ✅ RESOLVE COST CENTER IF PROVIDED
    if (updateData.cost_center_code) {
      const [centerRows] = await pool.query(
        'SELECT id FROM cost_centers WHERE code = ? AND active = TRUE',
        [updateData.cost_center_code]
      );
      
      if (centerRows.length > 0) {
        updateData.cost_center_id = centerRows[0].id;
        delete updateData.cost_center_code;
      }
    }
    
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), id];
    
    const [result] = await pool.query(
      `UPDATE incomes SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return await getById(id);
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.update:', error);
    throw error;
  }
}

/**
 * Delete income
 */
export async function deleteIncome(id) {
  try {
    console.log('🗑️ IncomeModel.deleteIncome:', id);
    
    const [result] = await pool.query(
      'DELETE FROM incomes WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.deleteIncome:', error);
    throw error;
  }
}

/**
 * Update only status
 */
export async function updateStatus(id, state) {
  try {
    console.log('🔄 IncomeModel.updateStatus:', id, state);
    
    const [result] = await pool.query(
      'UPDATE incomes SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [state, id]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return await getById(id);
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.updateStatus:', error);
    throw error;
  }
}

/**
 * Get incomes by cost center
 */
export async function getByCostCenter(costCenterId, options = {}) {
  try {
    console.log('🏢 IncomeModel.getByCostCenter:', costCenterId, options);
    
    let query = `
      SELECT 
        i.*,
        cc.code as cost_center_code,
        cc.name as center_name
      FROM incomes i
      LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
      WHERE i.cost_center_id = ?
    `;
    
    const queryParams = [costCenterId];
    
    if (options.state) {
      query += ' AND i.state = ?';
      queryParams.push(options.state);
    }
    
    query += ' ORDER BY i.date DESC, i.created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      queryParams.push(parseInt(options.limit));
    }
    
    const [rows] = await pool.query(query, queryParams);
    return rows;
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.getByCostCenter:', error);
    throw error;
  }
}

/**
 * Get income statistics
 */
export async function getStats(filters = {}) {
  try {
    console.log('📊 IncomeModel.getStats with filters:', filters);
    
    // ✅ BASE QUERY FOR STATS
    let baseQuery = `
      FROM incomes i
      LEFT JOIN cost_centers cc ON i.cost_center_id = cc.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // ✅ APPLY SAME FILTERS AS getAll
    if (filters.search) {
      baseQuery += ` AND (
        i.document_number LIKE ? OR
        i.client_name LIKE ? OR
        i.client_tax_id LIKE ? OR
        i.ep_detail LIKE ? OR
        cc.name LIKE ? OR
        cc.code LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.state) {
      baseQuery += ` AND i.state = ?`;
      queryParams.push(filters.state);
    }
    
    if (filters.costCenterId) {
      baseQuery += ` AND i.cost_center_id = ?`;
      queryParams.push(filters.costCenterId);
    }
    
    if (filters.clientId) {
      baseQuery += ` AND i.client_tax_id = ?`;
      queryParams.push(filters.clientId);
    }
    
    if (filters.startDate) {
      baseQuery += ` AND i.date >= ?`;
      queryParams.push(filters.startDate);
    }
    
    if (filters.endDate) {
      baseQuery += ` AND i.date <= ?`;
      queryParams.push(filters.endDate);
    }
    
    // ✅ MAIN STATS QUERY
    const [statsRows] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN i.state = 'borrador' THEN 1 ELSE 0 END) as borrador,
        SUM(CASE WHEN i.state = 'activo' THEN 1 ELSE 0 END) as activo,
        SUM(CASE WHEN i.state = 'facturado' THEN 1 ELSE 0 END) as facturado,
        SUM(CASE WHEN i.state = 'pagado' THEN 1 ELSE 0 END) as pagado,
        SUM(CASE WHEN i.state = 'cancelado' THEN 1 ELSE 0 END) as cancelado,
        SUM(i.ep_total) as monto_total,
        AVG(i.ep_total) as monto_promedio,
        SUM(CASE WHEN i.factoring IS NOT NULL AND i.factoring != '' THEN 1 ELSE 0 END) as factoring_count,
        SUM(CASE WHEN i.factoring IS NULL OR i.factoring = '' THEN 1 ELSE 0 END) as transfer_count
      ${baseQuery}
    `, queryParams);
    
    // ✅ STATS BY CLIENT
    const [clientStats] = await pool.query(`
      SELECT 
        i.client_name,
        i.client_tax_id,
        COUNT(*) as cantidad,
        SUM(i.ep_total) as monto_total
      ${baseQuery}
      GROUP BY i.client_name, i.client_tax_id
      ORDER BY monto_total DESC
      LIMIT 10
    `, queryParams);
    
    // ✅ STATS BY COST CENTER
    const [centerStats] = await pool.query(`
      SELECT 
        cc.code,
        cc.name,
        COUNT(*) as cantidad,
        SUM(i.ep_total) as monto_total
      ${baseQuery}
      AND cc.id IS NOT NULL
      GROUP BY cc.id, cc.code, cc.name
      ORDER BY monto_total DESC
      LIMIT 10
    `, queryParams);
    
    const stats = statsRows[0];
    
    // ✅ FORMAT GROUPED STATS
    const por_cliente = {};
    clientStats.forEach(row => {
      por_cliente[row.client_name] = {
        tax_id: row.client_tax_id,
        cantidad: parseInt(row.cantidad),
        monto_total: parseFloat(row.monto_total) || 0
      };
    });
    
    const por_centro = {};
    centerStats.forEach(row => {
      por_centro[row.code] = {
        nombre: row.name,
        cantidad: parseInt(row.cantidad),
        monto_total: parseFloat(row.monto_total) || 0
      };
    });
    
    return {
      ...stats,
      por_cliente,
      por_centro
    };
    
  } catch (error) {
    console.error('❌ Error in IncomeModel.getStats:', error);
    throw error;
  }
}