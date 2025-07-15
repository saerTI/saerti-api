import { pool } from '../../config/database.mjs';

/**
 * Helper function to map English status to Spanish ENUM values
 */
function mapStatusToSpanish(status) {
  const statusMap = {
    'draft': 'borrador',
    'pending': 'borrador',
    'active': 'activo', 
    'sent': 'activo',
    'approved': 'activo',
    'in_progress': 'en_progreso',
    'suspended': 'suspendido',
    'completed': 'completado',
    'received': 'completado',
    'paid': 'completado',
    'cancelled': 'cancelado',
    'canceled': 'cancelado'
  };
  
  return statusMap[status] || 'borrador'; // Default to 'borrador' if not found
}

/**
 * Helper function to get cost center ID by code
 */
async function getCostCenterIdByCode(code) {
  try {
    if (!code || code.trim() === '') {
      return null;
    }
    
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
 * Helper function to get account category ID by name or code
 */
async function getAccountCategoryIdByName(name) {
  try {
    if (!name || name.trim() === '') {
      return null;
    }
    
    // Try by name first
    let [rows] = await pool.query(
      'SELECT id FROM account_categories WHERE name = ? LIMIT 1',
      [name.trim()]
    );
    
    // If not found by name, try by code
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT id FROM account_categories WHERE code = ? LIMIT 1',
        [name.trim()]
      );
    }
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error(`Error searching account category with name ${name}:`, error);
    return null;
  }
}

/**
 * Helper function to get supplier ID by tax ID
 */
async function getSupplierIdByTaxId(taxId) {
  try {
    if (!taxId || taxId.trim() === '') {
      return null;
    }
    
    const [rows] = await pool.query(
      'SELECT id FROM suppliers WHERE tax_id = ? LIMIT 1',
      [taxId.trim()]
    );
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error(`Error searching supplier with tax ID ${taxId}:`, error);
    return null;
  }
}

/**
 * Gets all purchase orders with filters, search and pagination
 */
async function getAll(filters = {}, pagination = {}) {
  try {
    // Pagination parameters with default values
    const limit = parseInt(pagination.limit) || 50;
    const offset = parseInt(pagination.offset) || 0;
    const page = Math.floor(offset / limit) + 1;
    
    // Base query para datos
    let baseQuery = `
      FROM purchase_orders po
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // CONSTRUIR FILTROS UNA SOLA VEZ
    // Search filter by description/notes
    if (filters.search && filters.search.trim()) {
      baseQuery += ' AND (po.description LIKE ? OR po.notes LIKE ? OR po.po_number LIKE ?)';
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Status filter - MAP TO SPANISH
    if (filters.status) {
      const mappedStatus = mapStatusToSpanish(filters.status);
      baseQuery += ' AND po.status = ?';
      queryParams.push(mappedStatus);
    }
    
    // Cost center filter
    if (filters.costCenterId) {
      baseQuery += ' AND po.cost_center_id = ?';
      queryParams.push(filters.costCenterId);
    }
    
    // PO number filter
    if (filters.poNumber) {
      baseQuery += ' AND po.po_number LIKE ?';
      queryParams.push(`%${filters.poNumber}%`);
    }
    
    // Supplier filter
    if (filters.supplier) {
      baseQuery += ' AND s.legal_name LIKE ?';
      queryParams.push(`%${filters.supplier}%`);
    }
    
    // Date filters
    if (filters.dateFrom) {
      baseQuery += ' AND po.po_date >= ?';
      queryParams.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      baseQuery += ' AND po.po_date <= ?';
      queryParams.push(filters.dateTo);
    }
    
    // Category filter
    if (filters.categoryId) {
      baseQuery += ' AND po.account_category_id = ?';
      queryParams.push(filters.categoryId);
    }
    
    // Amount range filters
    if (filters.amountFrom) {
      baseQuery += ' AND po.total >= ?';
      queryParams.push(filters.amountFrom);
    }
    
    if (filters.amountTo) {
      baseQuery += ' AND po.total <= ?';
      queryParams.push(filters.amountTo);
    }
    
    // QUERY DE DATOS con JOIN completo
    const dataQuery = `
      SELECT 
        po.*, 
        cc.code as center_code, 
        cc.name as center_name,
        cc.type as center_type,
        ac.name as category_name,
        ac.code as category_code,
        COALESCE(po.supplier_name, s.legal_name) as supplier_name,
        s.tax_id as supplier_tax_id
      ${baseQuery}
      ORDER BY po.po_date DESC, po.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // QUERY DE CONTEO simplificado
    const countQuery = `
      SELECT COUNT(DISTINCT po.id) as total
      ${baseQuery}
    `;

    
    // EJECUTAR CONTEO PRIMERO (sin limit/offset)
    const [countResult] = await pool.query(countQuery, queryParams);
    
    // VALIDAR RESULTADO DE CONTEO
    if (!countResult || !Array.isArray(countResult) || countResult.length === 0) {
      console.warn('⚠️ Count query returned no results, using default values');
      return {
        data: [],
        pagination: {
          current_page: 1,
          per_page: limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      };
    }
    
    const total = countResult[0]?.total || 0;
    
    // Si no hay registros, devolver respuesta vacía
    if (total === 0) {
      return {
        data: [],
        pagination: {
          current_page: 1,
          per_page: limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      };
    }
    
    // EJECUTAR QUERY DE DATOS con paginación
    const dataParams = [...queryParams, limit, offset];
    console.log('📊 Data query:', dataQuery);
    console.log('📊 Data params:', dataParams);
    
    const [rows] = await pool.query(dataQuery, dataParams);
    console.log('📊 Data rows found:', rows.length);
    
    // CALCULAR PAGINACIÓN
    const totalPages = Math.ceil(total / limit);
    
    const paginationResult = {
      current_page: page,
      per_page: limit,
      total: total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    };
        
    return {
      data: rows || [],
      pagination: paginationResult
    };
    
  } catch (error) {
    console.error('❌ Error in getAll:', error);
    console.error('❌ Error stack:', error.stack);
    throw error;
  }
}

/**
 * Gets a purchase order by ID with related information
 */
async function getById(id) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        po.*, 
        cc.code as center_code, 
        cc.name as center_name,
        cc.type as center_type,
        ac.name as category_name,
        ac.code as category_code,
        s.legal_name as supplier_name,
        s.tax_id as supplier_tax_id,
        s.commercial_name as supplier_commercial_name
      FROM purchase_orders po
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `, [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting purchase order by ID:', error);
    throw error;
  }
}

/**
 * Creates a new purchase order
 */
async function create(poData) {
  try {
    console.log('📥 Creating/Updating purchase order with data:', poData);
    
    // VALIDACIONES CRÍTICAS ANTES DE INSERTAR
    if (!poData.po_number || poData.po_number.trim() === '') {
      throw new Error('Purchase order number is required and cannot be empty');
    }
    
    if (!poData.po_date) {
      console.warn('⚠️ No date provided, using current date');
      poData.po_date = new Date().toISOString().split('T')[0];
    }
    
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(poData.po_date)) {
      console.warn('⚠️ Invalid date format, using current date');
      poData.po_date = new Date().toISOString().split('T')[0];
    }
    
    // ASEGURAR VALORES POR DEFECTO PARA CAMPOS REQUERIDOS
    const cleanPoData = {
      po_number: poData.po_number.trim(),
      po_date: poData.po_date,
      description: poData.description?.trim() || `Orden ${poData.po_number}`,
      subtotal: parseFloat(poData.subtotal) || parseFloat(poData.total) || 0,
      total: parseFloat(poData.total) || parseFloat(poData.subtotal) || 0,
      currency: poData.currency?.trim() || 'CLP',
      status: mapStatusToSpanish(poData.status?.trim() || 'draft'),
      notes: poData.notes?.trim() || ''
    };
    
    // VALIDAR MONTOS
    if (cleanPoData.total <= 0) {
      throw new Error('Total amount must be greater than zero');
    }
    
    // MAPEAR CÓDIGOS A IDs CON MANEJO DE CAMPOS REQUERIDOS NULL
    let costCenterId = poData.cost_center_id;
    if (!costCenterId && poData.cost_center_code) {
      try {
        costCenterId = await getCostCenterIdByCode(poData.cost_center_code);
      } catch (error) {
        console.error('❌ Error mapping cost center:', error);
      }
    }
    
    // SI NO SE ENCUENTRA COST CENTER, USAR UNO POR DEFECTO O CREAR UNO GENÉRICO
    if (!costCenterId) {
      console.warn('⚠️ No cost center found, trying default...');
      try {
        // Intentar con códigos por defecto comunes
        const defaultCodes = ['001-0', 'GEN-001', 'DEFAULT', 'GENERAL'];
        for (const code of defaultCodes) {
          costCenterId = await getCostCenterIdByCode(code);
          if (costCenterId) {
            console.log(`✅ Using default cost center: ${code} (ID: ${costCenterId})`);
            break;
          }
        }
        
        // Si aún no hay cost center, obtener el primero disponible
        if (!costCenterId) {
          const [defaultCenterRows] = await pool.query(
            'SELECT id FROM cost_centers WHERE status = ? ORDER BY id ASC LIMIT 1',
            ['activo']
          );
          
          if (defaultCenterRows.length > 0) {
            costCenterId = defaultCenterRows[0].id;
            console.log(`✅ Using first available cost center (ID: ${costCenterId})`);
          } else {
            // Como último recurso, crear un cost center por defecto
            console.warn('⚠️ No cost centers found, creating default...');
            const [insertResult] = await pool.query(
              'INSERT INTO cost_centers (code, name, type, status) VALUES (?, ?, ?, ?)',
              ['DEFAULT-001', 'Centro de Costo General', 'administrativo', 'activo']
            );
            costCenterId = insertResult.insertId;
            console.log(`✅ Created default cost center (ID: ${costCenterId})`);
          }
        }
      } catch (error) {
        console.error('❌ Error getting/creating default cost center:', error);
        throw new Error('Cannot proceed without a valid cost center');
      }
    }
    
    let accountCategoryId = poData.account_category_id;
    if (!accountCategoryId && poData.category_name) {
      try {
        accountCategoryId = await getAccountCategoryIdByName(poData.category_name);
        if (!accountCategoryId) {
          console.warn(`⚠️ Account category not found: ${poData.category_name}`);
          // Intentar con categoría por defecto
          accountCategoryId = await getAccountCategoryIdByName('GASTOS IMPREVISTOS Y OTROS');
          if (!accountCategoryId) {
            console.warn('⚠️ Default account category not found, will proceed without category');
          }
        }
      } catch (error) {
        console.error('❌ Error mapping account category:', error);
        accountCategoryId = null;
      }
    }
    
    // Mapeo de proveedor (por ahora solo guardamos el nombre)
    let supplierId = poData.supplier_id;
    if (!supplierId && poData.supplier_tax_id) {
      try {
        supplierId = await getSupplierIdByTaxId(poData.supplier_tax_id);
      } catch (error) {
        console.error('❌ Error mapping supplier:', error);
        supplierId = null;
      }
    }
    
    // ASEGURAR QUE cost_center_id NO ES NULL
    if (!costCenterId) {
      throw new Error('cost_center_id cannot be null - no valid cost center found or created');
    }
    
    // PREPARAR DATOS FINALES PARA INSERCIÓN/ACTUALIZACIÓN
    const finalData = {
      po_number: cleanPoData.po_number,
      po_date: cleanPoData.po_date,
      description: cleanPoData.description,
      cost_center_id: costCenterId,
      account_category_id: accountCategoryId,
      supplier_id: supplierId,
      supplier_name: poData.supplier_name || poData.providerName || null,
      subtotal: cleanPoData.subtotal,
      total: cleanPoData.total,
      currency: cleanPoData.currency,
      status: cleanPoData.status,
      notes: cleanPoData.notes
    };
    
    console.log('📋 Final data for upsert:', {
      po_number: finalData.po_number,
      total: finalData.total,
      cost_center_id: finalData.cost_center_id,
      account_category_id: finalData.account_category_id,
      status: finalData.status,
      statusOriginal: poData.status
    });
    
    // ✅ VERIFICAR SI YA EXISTE UNA ORDEN CON ESE NÚMERO
    const [existingOrder] = await pool.query(
      'SELECT id FROM purchase_orders WHERE po_number = ?',
      [finalData.po_number]
    );
    
    if (existingOrder.length > 0) {
      // ✅ ACTUALIZAR REGISTRO EXISTENTE
      const existingId = existingOrder[0].id;
      console.log(`🔄 Updating existing purchase order with ID: ${existingId}`);
      
      const [updateResult] = await pool.query(
        `UPDATE purchase_orders SET 
          po_date = ?, description = ?, cost_center_id = ?, account_category_id = ?,
          supplier_id = ?, supplier_name = ?, subtotal = ?, total = ?, currency = ?, status = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          finalData.po_date,
          finalData.description,
          finalData.cost_center_id,
          finalData.account_category_id,
          finalData.supplier_id,
          finalData.supplier_name,
          finalData.subtotal,
          finalData.total,
          finalData.currency,
          finalData.status,
          finalData.notes,
          existingId
        ]
      );
      
      console.log('✅ Purchase order updated with ID:', existingId);
      
      return { 
        id: existingId,
        po_number: finalData.po_number,
        total: finalData.total,
        status: finalData.status,
        cost_center_id: finalData.cost_center_id,
        account_category_id: finalData.account_category_id,
        supplier_id: finalData.supplier_id,
        isUpdate: true // ✅ INDICADOR DE QUE FUE ACTUALIZACIÓN
      };
    } else {
      // ✅ CREAR NUEVO REGISTRO
      console.log('📝 Creating new purchase order');
      
      const [result] = await pool.query(
        `INSERT INTO purchase_orders (
          po_number, po_date, description, cost_center_id, account_category_id,
          supplier_id, supplier_name, subtotal, total, currency, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finalData.po_number,
          finalData.po_date,
          finalData.description,
          finalData.cost_center_id,
          finalData.account_category_id,
          finalData.supplier_id,
          finalData.supplier_name,
          finalData.subtotal,
          finalData.total,
          finalData.currency,
          finalData.status,
          finalData.notes
        ]
      );
      
      const insertedId = result.insertId;
      console.log('✅ Purchase order created with ID:', insertedId);
      
      return { 
        id: insertedId,
        po_number: finalData.po_number,
        total: finalData.total,
        status: finalData.status,
        cost_center_id: finalData.cost_center_id,
        account_category_id: finalData.account_category_id,
        supplier_id: finalData.supplier_id,
        isUpdate: false // ✅ INDICADOR DE QUE FUE CREACIÓN
      };
    }
    
  } catch (error) {
    console.error('❌ Error creating/updating purchase order:', error);
    console.error('❌ Original data:', poData);
    
    // MEJORAR MENSAJES DE ERROR
    if (error.code === 'ER_BAD_NULL_ERROR') {
      const fieldMatch = error.message.match(/Column '(.+?)' cannot be null/);
      const field = fieldMatch ? fieldMatch[1] : 'unknown';
      throw new Error(`Required field '${field}' is missing or null. Please check your data.`);
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      throw new Error('Referenced cost center, category, or supplier does not exist');
    }
    
    if (error.code === 'WARN_DATA_TRUNCATED') {
      throw new Error(`Invalid data provided. Please check ENUM values for status field.`);
    }
    
    throw error;
  }
}

/**
 * Updates an existing purchase order
 */
async function update(id, poData) {
  try {
    // Map cost center code to ID if provided
    let costCenterId = poData.cost_center_id;
    
    if (!costCenterId && poData.cost_center_code) {
      costCenterId = await getCostCenterIdByCode(poData.cost_center_code);
    }
    
    // Map category name to ID if provided
    let accountCategoryId = poData.account_category_id;
    
    if (!accountCategoryId && poData.category_name) {
      accountCategoryId = await getAccountCategoryIdByName(poData.category_name);
    }
    
    // Map supplier name/tax_id to ID if provided
    let supplierId = poData.supplier_id;
    
    if (!supplierId && poData.supplier_tax_id) {
      supplierId = await getSupplierIdByTaxId(poData.supplier_tax_id);
    }
    
    // ✅ MAP STATUS TO SPANISH
    const mappedStatus = poData.status ? mapStatusToSpanish(poData.status) : null;
    
    const [result] = await pool.query(
      `UPDATE purchase_orders SET 
        po_number = ?, po_date = ?, description = ?, cost_center_id = ?, 
        account_category_id = ?, supplier_id = ?, supplier_name = ?, subtotal = ?, total = ?, 
        currency = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        poData.po_number,
        poData.po_date,
        poData.description,
        costCenterId,
        accountCategoryId,
        supplierId,
        poData.supplier_name || poData.providerName || null,
        poData.subtotal,
        poData.total || poData.subtotal,
        poData.currency,
        mappedStatus,  // ✅ SPANISH VALUE
        poData.notes,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { 
      id, 
      ...poData, 
      cost_center_id: costCenterId,
      account_category_id: accountCategoryId,
      supplier_id: supplierId,
        supplier_name: poData.supplier_name || poData.providerName || null,
      status: mappedStatus
    };
  } catch (error) {
    console.error('Error updating purchase order:', error);
    throw error;
  }
}

/**
 * Deletes a purchase order
 */
async function deletePurchaseOrder(id) {
  try {
    const [result] = await pool.query(
      'DELETE FROM purchase_orders WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    throw error;
  }
}

/**
 * Gets quick statistics
 */
async function getStats(filters = {}) {
  try {
    console.log('📊 Getting stats with filters:', filters);
    
    // Query base simplificada
    let query = `
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'borrador' THEN 1 ELSE 0 END), 0) as borrador,
        COALESCE(SUM(CASE WHEN status = 'activo' THEN 1 ELSE 0 END), 0) as activo,
        COALESCE(SUM(CASE WHEN status = 'en_progreso' THEN 1 ELSE 0 END), 0) as en_progreso,
        COALESCE(SUM(CASE WHEN status = 'completado' THEN 1 ELSE 0 END), 0) as completado,
        COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) as cancelado,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(AVG(total), 0) as monto_promedio
      FROM purchase_orders po
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Aplicar filtros básicos
    if (filters.search && filters.search.trim()) {
      query += ' AND (po.description LIKE ? OR po.notes LIKE ? OR po.po_number LIKE ?)';
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.status) {
      const mappedStatus = mapStatusToSpanish(filters.status);
      query += ' AND po.status = ?';
      queryParams.push(mappedStatus);
    }
    
    if (filters.costCenterId) {
      query += ' AND po.cost_center_id = ?';
      queryParams.push(filters.costCenterId);
    }
    
    const [rows] = await pool.query(query, queryParams);
    
    if (!rows || rows.length === 0) {
      console.warn('⚠️ Stats query returned no results, using defaults');
      return {
        total: 0,
        borrador: 0,
        activo: 0,
        en_progreso: 0,
        completado: 0,
        cancelado: 0,
        monto_total: 0,
        monto_promedio: 0
      };
    }
    
    const result = rows[0];
    console.log('✅ Stats result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Error getting purchase order statistics:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Devolver stats por defecto en caso de error
    return {
      total: 0,
      borrador: 0,
      activo: 0,
      en_progreso: 0,
      completado: 0,
      cancelado: 0,
      monto_total: 0,
      monto_promedio: 0
    };
  }
}

/**
 * Gets purchase orders by cost center
 */
async function getByCostCenter(costCenterId, options = {}) {
  try {
    const limit = options.limit || 100;
    const status = options.status;
    
    let query = `
      SELECT 
        po.*, 
        cc.code as center_code, 
        cc.name as center_name,
        ac.name as category_name,
        s.legal_name as supplier_name
      FROM purchase_orders po
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.cost_center_id = ?
    `;
    
    let queryParams = [costCenterId];
    
    if (status) {
      const mappedStatus = mapStatusToSpanish(status);
      query += ' AND po.status = ?';
      queryParams.push(mappedStatus);
    }
    
    query += ' ORDER BY po.po_date DESC LIMIT ?';
    queryParams.push(limit);
    
    const [rows] = await pool.query(query, queryParams);
    return rows;
  } catch (error) {
    console.error('Error getting purchase orders by cost center:', error);
    throw error;
  }
}

export {
  getAll,
  getById,
  create,
  update,
  deletePurchaseOrder as delete,
  getStats,
  getByCostCenter,
  getCostCenterIdByCode,
  getAccountCategoryIdByName,
  getSupplierIdByTaxId,
  mapStatusToSpanish
};