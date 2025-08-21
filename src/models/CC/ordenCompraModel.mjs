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
 * Helper function to get default cost center ID
 */
async function getDefaultCostCenterId() {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM cost_centers ORDER BY id ASC LIMIT 1'
    );
    
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error('Error getting default cost center:', error);
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
    
    // Build JOINs used by both queries
    const joins = `
      LEFT JOIN (
        SELECT purchase_order_id, SUM(total) as amount
        FROM purchase_order_items
        GROUP BY purchase_order_id
      ) poi ON poi.purchase_order_id = po.id
      LEFT JOIN (
        SELECT 
          poi_items.purchase_order_id,
          GROUP_CONCAT(DISTINCT ac_items.name ORDER BY ac_items.name SEPARATOR ', ') as item_categories
        FROM purchase_order_items poi_items
        LEFT JOIN account_categories ac_items ON poi_items.account_category_id = ac_items.id
        WHERE ac_items.name IS NOT NULL
        GROUP BY poi_items.purchase_order_id
      ) poi_categories ON poi_categories.purchase_order_id = po.id
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
    `;

    // Build WHERE clause and params once
    const whereClauses = ['1=1'];
    const queryParams = [];

    // Filtro de búsqueda (description / po_number)
    if (filters.search && filters.search.trim()) {
      whereClauses.push('(po.description LIKE ? OR po.po_number LIKE ?)');
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    // Status filter - MAP TO SPANISH
    if (filters.status) {
      const mappedStatus = mapStatusToSpanish(filters.status);
      whereClauses.push('po.status = ?');
      queryParams.push(mappedStatus);
    }

    // Cost center filter
    if (filters.costCenterId) {
      whereClauses.push('po.cost_center_id = ?');
      queryParams.push(filters.costCenterId);
    }

    // PO number filter
    if (filters.poNumber) {
      whereClauses.push('po.po_number LIKE ?');
      queryParams.push(`%${filters.poNumber}%`);
    }

    // Supplier filter
    if (filters.supplier) {
      whereClauses.push('s.legal_name LIKE ?');
      queryParams.push(`%${filters.supplier}%`);
    }

    // Date filters
    if (filters.dateFrom) {
      whereClauses.push('po.po_date >= ?');
      queryParams.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClauses.push('po.po_date <= ?');
      queryParams.push(filters.dateTo);
    }

    // Category filter
    if (filters.categoryId) {
      whereClauses.push('po.account_category_id = ?');
      queryParams.push(filters.categoryId);
    }

    // Filtros por monto usando suma de ítems
    if (filters.amountFrom) {
      whereClauses.push('COALESCE(poi.amount,0) >= ?');
      queryParams.push(filters.amountFrom);
    }
    if (filters.amountTo) {
      whereClauses.push('COALESCE(poi.amount,0) <= ?');
      queryParams.push(filters.amountTo);
    }

    // COUNT query
    const countQuery = `
      SELECT COUNT(DISTINCT po.id) as total
      FROM purchase_orders po
      ${joins}
      WHERE ${whereClauses.join(' AND ')}
    `;

    // DATA query
    const dataQuery = `
      SELECT 
        po.*, 
        cc.code as center_code, 
        cc.name as center_name,
        cc.type as center_type,
        ac.code as category_code,
        po.supplier_name, -- ✅ Usar supplier_name directamente
        COALESCE(poi.amount, 0) as total_amount,
        COALESCE(poi_categories.item_categories, ac.name) as category_name -- ✅ Usar categorías de ítems concatenadas, fallback a categoría principal
      FROM purchase_orders po
      ${joins}
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY po.po_date DESC, po.created_at DESC
      LIMIT ? OFFSET ?
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
        ac.code as category_code,
        po.supplier_name, -- ✅ Usar supplier_name directamente de la tabla purchase_orders
        COALESCE(poi.amount,0) as total_amount,
        COALESCE(poi_categories.item_categories, ac.name) as category_name -- ✅ Usar categorías de ítems concatenadas, fallback a categoría principal
      FROM purchase_orders po
      LEFT JOIN (
        SELECT purchase_order_id, SUM(total) as amount 
        FROM purchase_order_items 
        GROUP BY purchase_order_id
      ) poi ON poi.purchase_order_id = po.id
      LEFT JOIN (
        SELECT 
          poi_items.purchase_order_id,
          GROUP_CONCAT(DISTINCT ac_items.name ORDER BY ac_items.name SEPARATOR ', ') as item_categories
        FROM purchase_order_items poi_items
        LEFT JOIN account_categories ac_items ON poi_items.account_category_id = ac_items.id
        WHERE ac_items.name IS NOT NULL
        GROUP BY poi_items.purchase_order_id
      ) poi_categories ON poi_categories.purchase_order_id = po.id
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
      WHERE po.id = ?
    `, [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting purchase order by ID:', error);
    throw error;
  }
}

/**
 * Extrae el código de proyecto del número de purchase order
 * @param {string} poNumber - Número de PO (ej: "OC-038-117", "OC-001-399")
 * @returns {string|null} - Código de proyecto (ej: "038", "001-0") o null
 */
function extractProjectCodeFromPO(poNumber) {
  if (!poNumber || typeof poNumber !== 'string') {
    return null;
  }
  
  // Patrón: OC-XXX-YYY donde XXX es el código del proyecto
  const match = poNumber.match(/^OC-(\d{3})-/);
  
  if (match) {
    const projectCode = match[1]; // "038", "041", "039", "001"
    
    // Mapeo especial para código 001 (va a Oficina Central)
    if (projectCode === '001') {
      return '001-0'; // Oficina Central
    }
    
    // Para otros códigos, usar directamente
    return projectCode; // "038", "041", "039", etc.
  }
  
  console.warn(`⚠️ No se pudo extraer código de proyecto de: ${poNumber}`);
  return null;
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
      description: poData.notes?.trim() || poData.description?.trim() || `Orden ${poData.po_number}`, // ✅ Usar notes como description
      // Montos ahora se calculan desde purchase_order_items
      status: mapStatusToSpanish(poData.status?.trim() || 'draft'),
      // notes eliminado del esquema
    };
    // Ya no se valida total aquí porque los ítems definen el monto
    
    // MAPEAR CÓDIGOS A IDs CON MANEJO DE CAMPOS REQUERIDOS NULL
    let costCenterId = poData.cost_center_id;
    if (!costCenterId && poData.po_number) {
      const projectCode = extractProjectCodeFromPO(poData.po_number);
      if (projectCode) {
        console.log(`🎯 Extracted project code "${projectCode}" from PO: ${poData.po_number}`);
        try {
          costCenterId = await getCostCenterIdByCode(projectCode);
          if (costCenterId) {
            console.log(`✅ Mapped to cost center ID: ${costCenterId}`);
          }
        } catch (error) {
          console.error(`❌ Error mapping project code "${projectCode}":`, error);
        }
      }
    }
    // Si hay cost_center_code explícito, usarlo
    if (!costCenterId && poData.cost_center_code) {
      try {
        costCenterId = await getCostCenterIdByCode(poData.cost_center_code);
      } catch (error) {
        console.error('❌ Error mapping cost center:', error);
      }
    }
        
    // Use default cost center if none found
    if (!costCenterId) {
      console.warn('⚠️ No cost center found, using default...');
      try {
        costCenterId = await getDefaultCostCenterId();
        if (costCenterId) {
          console.log(`✅ Using default cost center (ID: ${costCenterId})`);
        } else {
          throw new Error('No cost centers available in database');
        }
      } catch (error) {
        console.error('❌ Error getting default cost center:', error);
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
    
    // Mapeo de proveedor (solo usar supplier_name)
    let supplierId = null; // ✅ Ignorar supplier_id, solo usar supplier_name
    
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
      supplier_name: poData.supplier_name || poData.providerName || null,
      status: cleanPoData.status,
  // Campos derivados: total se obtiene de items
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
      
      await pool.query(
        `UPDATE purchase_orders SET 
          po_date = ?, description = ?, cost_center_id = ?, account_category_id = ?,
          supplier_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          finalData.po_date,
          finalData.description,
          finalData.cost_center_id,
          finalData.account_category_id,
          finalData.supplier_name,
          finalData.status,
          existingId
        ]
      );
      
      console.log('✅ Purchase order updated with ID:', existingId);
      
      return { 
        id: existingId,
        po_number: finalData.po_number,
  // total_amount se obtiene por items
        status: finalData.status,
        cost_center_id: finalData.cost_center_id,
        account_category_id: finalData.account_category_id,
        supplier_name: finalData.supplier_name,
        isUpdate: true // ✅ INDICADOR DE QUE FUE ACTUALIZACIÓN
      };
    } else {
      // ✅ CREAR NUEVO REGISTRO
      console.log('📝 Creating new purchase order');
      
      const [result] = await pool.query(
        `INSERT INTO purchase_orders (
          po_number, po_date, description, cost_center_id, account_category_id,
          supplier_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          finalData.po_number,
          finalData.po_date,
          finalData.description,
          finalData.cost_center_id,
          finalData.account_category_id,
          finalData.supplier_name,
          finalData.status
        ]
      );
      
      const insertedId = result.insertId;
      console.log('✅ Purchase order created with ID:', insertedId);
      
      return { 
        id: insertedId,
        po_number: finalData.po_number,
  // total_amount se obtiene por items
        status: finalData.status,
        cost_center_id: finalData.cost_center_id,
        account_category_id: finalData.account_category_id,
        supplier_name: finalData.supplier_name,
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
    
    // Use default cost center if none provided
    if (!costCenterId) {
      costCenterId = await getDefaultCostCenterId();
      console.log('🔧 Using default cost center ID:', costCenterId);
    }

    // Map category name to ID if provided
    let accountCategoryId = poData.account_category_id;    if (!accountCategoryId && poData.category_name) {
      accountCategoryId = await getAccountCategoryIdByName(poData.category_name);
    }
    
    // Map supplier name/tax_id to ID if provided
    let supplierId = null; // ✅ Ignorar supplier_id, solo usar supplier_name
    
    // ✅ MAP STATUS TO SPANISH
    const mappedStatus = poData.status ? mapStatusToSpanish(poData.status) : null;
    
    console.log('🔍 Final values before UPDATE:', {
      costCenterId,
      accountCategoryId,
      supplier_name: poData.supplier_name || poData.providerName || null,
      mappedStatus,
      fieldsToUpdate: Object.keys(poData),
      hasOwnPropertyChecks: {
        po_number: poData.hasOwnProperty('po_number'),
        po_date: poData.hasOwnProperty('po_date'),
        notes: poData.hasOwnProperty('notes'),
        description: poData.hasOwnProperty('description'),
        cost_center_id: poData.hasOwnProperty('cost_center_id'),
        cost_center_code: poData.hasOwnProperty('cost_center_code'),
        supplier_name: poData.hasOwnProperty('supplier_name'),
        status: poData.hasOwnProperty('status'),
        state: poData.hasOwnProperty('state')
      }
    });
    
    // Construir consulta dinámicamente solo con campos presentes
    const updateFields = [];
    const updateValues = [];
    
    if (poData.hasOwnProperty('po_number') && poData.po_number !== undefined) {
      updateFields.push('po_number = ?');
      updateValues.push(poData.po_number);
    }
    
    if (poData.hasOwnProperty('po_date') && poData.po_date !== undefined) {
      updateFields.push('po_date = ?');
      updateValues.push(poData.po_date);
    }
    
    if (poData.hasOwnProperty('notes') || poData.hasOwnProperty('description')) {
      if (poData.notes !== undefined || poData.description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(poData.notes || poData.description);
      }
    }
    
    // Solo actualizar cost_center_id si se proporciona explícitamente
    if (poData.hasOwnProperty('cost_center_id') || poData.hasOwnProperty('cost_center_code')) {
      updateFields.push('cost_center_id = ?');
      updateValues.push(costCenterId);
    }
    
    // Solo actualizar account_category_id si se proporciona explícitamente
    if (poData.hasOwnProperty('account_category_id') || poData.hasOwnProperty('category_name')) {
      updateFields.push('account_category_id = ?');
      updateValues.push(accountCategoryId);
    }
    
    if (poData.hasOwnProperty('supplier_name') || poData.hasOwnProperty('providerName')) {
      if (poData.supplier_name !== undefined || poData.providerName !== undefined) {
        updateFields.push('supplier_name = ?');
        updateValues.push(poData.supplier_name || poData.providerName);
      }
    }
    
    if (poData.hasOwnProperty('status') || poData.hasOwnProperty('state')) {
      if (mappedStatus !== undefined && mappedStatus !== null) {
        updateFields.push('status = ?');
        updateValues.push(mappedStatus);
      }
    }
    
    // Siempre actualizar updated_at
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Si no hay campos para actualizar, retornar error
    if (updateFields.length === 1) { // Solo updated_at
      throw new Error('No fields to update');
    }
    
    const query = `UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);
    
    console.log('🔧 Dynamic UPDATE query:', query);
    console.log('🔧 Values:', updateValues);
    
    const [result] = await pool.query(query, updateValues);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return { 
      id, 
      ...poData, 
      cost_center_id: costCenterId,
      account_category_id: accountCategoryId,
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
        COALESCE(SUM(CASE WHEN po.status = 'borrador' THEN 1 ELSE 0 END), 0) as borrador,
        COALESCE(SUM(CASE WHEN po.status = 'activo' THEN 1 ELSE 0 END), 0) as activo,
        COALESCE(SUM(CASE WHEN po.status = 'en_progreso' THEN 1 ELSE 0 END), 0) as en_progreso,
        COALESCE(SUM(CASE WHEN po.status = 'completado' THEN 1 ELSE 0 END), 0) as completado,
        COALESCE(SUM(CASE WHEN po.status = 'cancelado' THEN 1 ELSE 0 END), 0) as cancelado,
        COALESCE(SUM(poi.amount), 0) as monto_total,
        COALESCE(AVG(poi.amount), 0) as monto_promedio
      FROM purchase_orders po
      LEFT JOIN (
        SELECT purchase_order_id, SUM(total) as amount
        FROM purchase_order_items
        GROUP BY purchase_order_id
      ) poi ON poi.purchase_order_id = po.id
      WHERE 1=1
    `;
    
    let queryParams = [];
    
    // Aplicar filtros básicos
    if (filters.search && filters.search.trim()) {
      query += ' AND (po.description LIKE ? OR po.po_number LIKE ?)';
      const searchTerm = `%${filters.search.trim()}%`;
      queryParams.push(searchTerm, searchTerm);
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
        ac.code as category_code,
        po.supplier_name, -- ✅ Usar supplier_name directamente
        COALESCE(poi.amount,0) as total_amount,
        COALESCE(poi_categories.item_categories, ac.name) as category_name -- ✅ Usar categorías de ítems concatenadas, fallback a categoría principal
      FROM purchase_orders po
      LEFT JOIN (
        SELECT purchase_order_id, SUM(total) as amount
        FROM purchase_order_items
        GROUP BY purchase_order_id
      ) poi ON poi.purchase_order_id = po.id
      LEFT JOIN (
        SELECT 
          poi_items.purchase_order_id,
          GROUP_CONCAT(DISTINCT ac_items.name ORDER BY ac_items.name SEPARATOR ', ') as item_categories
        FROM purchase_order_items poi_items
        LEFT JOIN account_categories ac_items ON poi_items.account_category_id = ac_items.id
        WHERE ac_items.name IS NOT NULL
        GROUP BY poi_items.purchase_order_id
      ) poi_categories ON poi_categories.purchase_order_id = po.id
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id 
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
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
  getDefaultCostCenterId,
  mapStatusToSpanish
};