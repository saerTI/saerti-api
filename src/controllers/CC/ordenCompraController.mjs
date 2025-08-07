import * as ordenCompraModel from '../../models/CC/ordenCompraModel.mjs';

const mapStatusToSpanish = (status) => {
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
  
  return statusMap[status] || 'borrador';
};

/**
 * Gets all purchase orders with optional filters and pagination
 */
async function getPurchaseOrders(req, res, next) {
  try {
    console.log('🔍 Getting purchase orders with query:', req.query);
    
    // ✅ VALIDAR PARÁMETROS DE ENTRADA
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    // ✅ LIMPIAR Y VALIDAR FILTROS
    const filters = {};
    
    if (req.query.search && req.query.search.trim()) {
      filters.search = req.query.search.trim();
    }
    
    if (req.query.status && req.query.status.trim()) {
      filters.status = req.query.status.trim();
    }
    
    if (req.query.state && req.query.state.trim()) {
      filters.status = req.query.state.trim();
    }
    
    if (req.query.costCenterId) {
      const costCenterId = parseInt(req.query.costCenterId);
      if (!isNaN(costCenterId)) {
        filters.costCenterId = costCenterId;
      }
    }
    
    if (req.query.poNumber && req.query.poNumber.trim()) {
      filters.poNumber = req.query.poNumber.trim();
    }
    
    if (req.query.supplier && req.query.supplier.trim()) {
      filters.supplier = req.query.supplier.trim();
    }
    
    // Filtros de fecha
    if (req.query.dateFrom || req.query.fechaDesde) {
      const dateFrom = req.query.dateFrom || req.query.fechaDesde;
      if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        filters.dateFrom = dateFrom;
      }
    }
    
    if (req.query.dateTo || req.query.fechaHasta) {
      const dateTo = req.query.dateTo || req.query.fechaHasta;
      if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        filters.dateTo = dateTo;
      }
    }
    
    if (req.query.categoryId) {
      const categoryId = parseInt(req.query.categoryId);
      if (!isNaN(categoryId)) {
        filters.categoryId = categoryId;
      }
    }
    
    // Filtros de monto
    if (req.query.amountFrom) {
      const amountFrom = parseFloat(req.query.amountFrom);
      if (!isNaN(amountFrom)) {
        filters.amountFrom = amountFrom;
      }
    }
    
    if (req.query.amountTo) {
      const amountTo = parseFloat(req.query.amountTo);
      if (!isNaN(amountTo)) {
        filters.amountTo = amountTo;
      }
    }

    const pagination = { limit, offset };
    
    console.log('📊 Processed filters:', filters);
    console.log('📊 Pagination:', pagination);

    // ✅ OBTENER DATOS
    let result;
    try {
      result = await ordenCompraModel.getAll(filters, pagination);
    } catch (modelError) {
      console.error('❌ Model error:', modelError);
      result = {
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
    
    // ✅ OBTENER ESTADÍSTICAS
    let stats;
    try {
      stats = await ordenCompraModel.getStats(filters);
    } catch (statsError) {
      console.error('❌ Stats error:', statsError);
      stats = {
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
    
    // ✅ ASEGURAR ESTRUCTURA CORRECTA
    if (!result || !result.data) {
      result = {
        data: [],
        pagination: {
          current_page: Math.floor(offset / limit) + 1,
          per_page: limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      };
    }
    
    // ✅ TRANSFORMAR DATOS PARA EL FRONTEND
    const transformedData = result.data.map(row => ({
      id: row.id,
      name: row.description || `Orden ${row.po_number}`,
      order_number: row.po_number,
      description: row.description,
      cost_center_id: row.cost_center_id,
      account_category_id: row.account_category_id,
      provider_name: row.supplier_name || 'Sin proveedor',
      amount: parseFloat(row.total) || 0,
      date: row.po_date,
      payment_type: 'credit', // Default, ya que no tienes este campo en la DB
      state: row.status, // Mantener en español para la transformación
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      center_code: row.center_code,
      center_name: row.center_name,
      center_type: row.center_type,
      categoria_name: row.category_name,
      category_code: row.category_code,
      supplier_name: row.supplier_name,
      supplier_tax_id: row.supplier_tax_id
    }));
    
    // ✅ TRANSFORMAR ESTADÍSTICAS
    const transformedStats = {
      total: parseInt(stats.total) || 0,
      borrador: parseInt(stats.borrador) || 0,
      activo: parseInt(stats.activo) || 0,
      en_progreso: parseInt(stats.en_progreso) || 0,
      completado: parseInt(stats.completado) || 0,
      cancelado: parseInt(stats.cancelado) || 0,
      monto_total: parseFloat(stats.monto_total) || 0,
      monto_promedio: parseFloat(stats.monto_promedio) || 0,
      
      // Mapear a nombres que espera el frontend
      totalOrdenes: parseInt(stats.total) || 0,
      montoTotal: parseFloat(stats.monto_total) || 0,
      
      // Estados para el frontend
      pending: parseInt(stats.borrador) || 0,
      approved: parseInt(stats.activo) || 0,
      received: parseInt(stats.completado) || 0,
      paid: parseInt(stats.completado) || 0,
      delivered: parseInt(stats.completado) || 0,
      cancelled: parseInt(stats.cancelado) || 0,
      
      // Tipos de pago (por defecto, ya que no tienes este campo)
      creditCount: parseInt(stats.total) || 0,
      cashCount: 0,
      
      // Agrupaciones
      porGrupo: {}
    };
    
    // ✅ RESPUESTA FINAL
    res.json({
      success: true,
      data: transformedData,
      pagination: result.pagination,
      stats: transformedStats,
      filters: filters
    });
    
  } catch (error) {
    console.error('❌ Controller error in getPurchaseOrders:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes de compra',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      data: [],
      pagination: {
        current_page: 1,
        per_page: parseInt(req.query.limit) || 25,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      },
      stats: {
        total: 0,
        totalOrdenes: 0,
        montoTotal: 0,
        borrador: 0,
        activo: 0,
        en_progreso: 0,
        completado: 0,
        cancelado: 0,
        pending: 0,
        approved: 0,
        received: 0,
        paid: 0,
        delivered: 0,
        cancelled: 0,
        creditCount: 0,
        cashCount: 0,
        porGrupo: {}
      }
    });
  }
}

/**
 * Gets a purchase order by ID
 */
async function getPurchaseOrderById(req, res, next) {
  try {
    console.log('🔍 Getting purchase order by ID:', req.params.id);
    const { id } = req.params;
    const purchaseOrder = await ordenCompraModel.getById(id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }
    
    // ✅ TRANSFORMAR DATOS PARA EL FRONTEND
    const transformedData = {
      id: purchaseOrder.id,
      name: purchaseOrder.description || `Orden ${purchaseOrder.po_number}`,
      order_number: purchaseOrder.po_number,
      description: purchaseOrder.description,
      cost_center_id: purchaseOrder.cost_center_id,
      account_category_id: purchaseOrder.account_category_id,
      provider_name: purchaseOrder.supplier_name || 'Sin proveedor',
      amount: parseFloat(purchaseOrder.total) || 0,
      date: purchaseOrder.po_date,
      payment_type: 'credit',
      state: purchaseOrder.status,
      notes: purchaseOrder.notes,
      created_at: purchaseOrder.created_at,
      updated_at: purchaseOrder.updated_at,
      center_code: purchaseOrder.center_code,
      center_name: purchaseOrder.center_name,
      categoria_name: purchaseOrder.category_name,
      supplier_name: purchaseOrder.supplier_name
    };


    return res.json({
      success: true,
      data: transformedData
    });


  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new individual purchase order
 */
async function createPurchaseOrder(req, res, next) {
  try {
    console.log('📤 Creating individual purchase order:', req.body);
    
    // ✅ MAPEO FLEXIBLE DE CAMPOS
    const poNumber = req.body.poNumber || req.body.po_number || req.body.orderNumber;
    const poDate = req.body.poDate || req.body.po_date || req.body.date;
    const description = req.body.description || req.body.notes || req.body.name;
    
    // ✅ VALIDACIONES CRÍTICAS
    if (!poNumber || poNumber.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order number is required',
        field: 'poNumber'
      });
    }
    
    const providerName = req.body.providerName || req.body.supplierName || req.body.supplier;
    if (!providerName || providerName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Provider name is required',
        field: 'providerName'
      });
    }
    
    const amount = parseFloat(req.body.total) || parseFloat(req.body.amount) || parseFloat(req.body.subtotal) || 0;
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than zero',
        field: 'amount'
      });
    }
    
    const poData = {
      po_number: poNumber.trim(),
      po_date: poDate || new Date().toISOString().split('T')[0],
      description: description?.trim() || `Orden ${poNumber}`,
      cost_center_code: req.body.costCenterCode || req.body.centerCode || req.body.centroCosto || null,
      category_name: req.body.categoryName || req.body.category || req.body.categoriaNombre || null,
      supplier_name: providerName.trim(),
      subtotal: amount,
      total: amount,
      currency: req.body.currency || 'CLP',
      status: mapStatusToSpanish(req.body.status || req.body.state || 'draft'),
      notes: req.body.notes || ''
    };
    
    console.log('📤 Processed purchase order data:', poData);
    
    const result = await ordenCompraModel.create(poData);
    
    // ✅ MENSAJE DIFERENTE SEGÚN SI FUE CREACIÓN O ACTUALIZACIÓN
    const message = result.isUpdate 
      ? 'Purchase order updated successfully'
      : 'Purchase order created successfully';
    
    console.log(`✅ Purchase order ${result.isUpdate ? 'updated' : 'created'} with ID:`, result.id);
    
    res.status(result.isUpdate ? 200 : 201).json({
      success: true,
      message: message,
      isUpdate: result.isUpdate, // ✅ INDICAR SI FUE ACTUALIZACIÓN
      data: {
        id: result.id,
        po_number: result.po_number || poData.po_number,
        total: result.total || poData.total
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating/updating individual purchase order:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error processing purchase order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

/**
 * Creates multiple purchase orders in batch
 */
async function createPurchaseOrdersBatch(req, res, next) {
  try {
    console.log('🚀 Batch request body:', JSON.stringify(req.body, null, 2));
    
    // ✅ OBTENER ARRAY DE ÓRDENES
    let ordersData = req.body.ordenes || req.body.orders || req.body;
    
    if (!Array.isArray(ordersData)) {
      if (req.body.data && Array.isArray(req.body.data)) {
        ordersData = req.body.data;
      } else {
        console.error('❌ Expected array format, received:', typeof ordersData);
        return res.status(400).json({
          success: false,
          message: 'Expected an array of purchase orders',
          received: typeof ordersData
        });
      }
    }
    
    console.log(`📊 Processing ${ordersData.length} orders`);
    
    if (ordersData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Orders array cannot be empty'
      });
    }
    
    if (ordersData.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 1000 orders per batch'
      });
    }
    
    const createdIds = [];
    const updatedIds = []; // ✅ NUEVO: Array para IDs actualizados
    const errorItems = [];
    
    console.log('🚀 Starting purchase orders batch...');
    console.log('📊 Sample order data:', JSON.stringify(ordersData[0], null, 2));
    
    // ✅ PROCESAR CADA ORDEN
    for (const [index, item] of ordersData.entries()) {
      try {
        const poNumber = item.poNumber || item.po_number || item.orderNumber || `AUTO-${Date.now()}-${index}`;
        const poDate = item.poDate || item.po_date || item.date || new Date().toISOString().split('T')[0];
        const description = item.description || item.notes || item.name || `Orden ${poNumber}`;
        
        const providerName = item.providerName || item.supplierName || item.supplier || 'Proveedor no especificado';
        const amount = parseFloat(item.total) || parseFloat(item.amount) || parseFloat(item.subtotal) || 0;
        const costCenterCode = item.costCenterCode || item.centerCode || item.centroCosto || null;
        const categoryName = item.categoryName || item.category || item.categoriaNombre || null;
        
        // ✅ VALIDACIONES CRÍTICAS
        if (!poNumber || poNumber.trim() === '') {
          throw new Error('Número de orden es requerido');
        }
        
        if (!providerName || providerName.trim() === '') {
          throw new Error('Nombre del proveedor es requerido');
        }
        
        if (amount <= 0) {
          throw new Error('Monto debe ser mayor a cero');
        }
        
        const poData = {
          po_number: poNumber.trim(),
          po_date: poDate,
          description: description.trim(),
          cost_center_code: costCenterCode?.trim() || null,
          category_name: categoryName?.trim() || null,
          supplier_name: providerName.trim(),
          subtotal: amount,
          total: amount,
          currency: item.currency || 'CLP',
          status: mapStatusToSpanish(item.status || item.state || 'draft'),
          notes: item.notes || `Importado en lote - ${new Date().toISOString()}`
        };
        
        console.log(`📋 Creating/Updating order ${index + 1}/${ordersData.length}: ${poData.po_number}`);
        
        const result = await ordenCompraModel.create(poData);
        
        // ✅ SEPARAR CREACIONES DE ACTUALIZACIONES
        if (result.isUpdate) {
          updatedIds.push(result.id);
          console.log(`🔄 Updated order ${index + 1}/${ordersData.length} with ID: ${result.id}`);
        } else {
          createdIds.push(result.id);
          console.log(`✅ Created order ${index + 1}/${ordersData.length} with ID: ${result.id}`);
        }
        
        if ((index + 1) % 10 === 0 || index < 5) {
          console.log(`📊 Progress: ${index + 1}/${ordersData.length} processed`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing order ${index + 1}:`, error.message);
        
        errorItems.push({
          index,
          item: {
            po_number: item.poNumber || item.po_number || item.orderNumber || `ORDER-${index}`,
            description: item.description || item.notes || item.name || '',
            amount: item.total || item.amount || item.subtotal || 0,
            category: item.categoryName || item.category || item.categoriaNombre || '',
            error: error.message
          }
        });
      }
    }
    
    // ✅ DETERMINAR ESTADO DE LA RESPUESTA
    const total = ordersData.length;
    const created = createdIds.length;
    const updated = updatedIds.length; // ✅ NUEVO: Conteo de actualizaciones
    const processed = created + updated; // ✅ NUEVO: Total procesado exitosamente
    const errors = errorItems.length;
    
    let status = 'success';
    let httpStatus = 201;
    let message = `${created} órdenes creadas, ${updated} actualizadas`;
    
    if (errors > 0 && processed > 0) {
      status = 'partial_success';
      httpStatus = 207;
      message = `${created} creadas, ${updated} actualizadas, ${errors} errores`;
    } else if (errors > 0 && processed === 0) {
      status = 'error';
      httpStatus = 400;
      message = `No se pudieron procesar las órdenes. ${errors} errores`;
    } else if (updated > 0 && created === 0) {
      message = `${updated} órdenes actualizadas exitosamente`;
    } else if (created > 0 && updated === 0) {
      message = `${created} órdenes creadas exitosamente`;
    }
    
    console.log(`✅ Batch completed: ${created} created, ${updated} updated, ${errors} errors`);
    
    res.status(httpStatus).json({
      success: status !== 'error',
      status: status,
      message: message,
      data: {
        ids: [...createdIds, ...updatedIds], // ✅ COMBINAR AMBOS ARRAYS
        created: created,
        updated: updated, // ✅ NUEVO: Campo para actualizaciones
        processed: processed, // ✅ NUEVO: Total procesado
        errors: errorItems,
        total: total,
        // ✅ NUEVO: Información detallada
        details: {
          createdIds: createdIds,
          updatedIds: updatedIds
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in purchase orders batch:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during batch processing',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
}

/**
 * Updates an existing purchase order
 */
async function updatePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    
    const poData = {
      po_number: req.body.poNumber || req.body.po_number,
      po_date: req.body.poDate || req.body.po_date,
      description: req.body.description,
      cost_center_id: req.body.costCenterId || null,
      cost_center_code: req.body.costCenterCode || req.body.centerCode || null,
      account_category_id: req.body.accountCategoryId || req.body.categoryId || null,
      category_name: req.body.categoryName || req.body.category || null,
      supplier_id: req.body.supplierId || null,
      supplier_tax_id: req.body.supplierTaxId || req.body.supplierRut || null,
      subtotal: parseFloat(req.body.subtotal) || 0,
      total: parseFloat(req.body.total) || parseFloat(req.body.subtotal) || 0,
      currency: req.body.currency || 'CLP',
      status: mapStatusToSpanish(req.body.status || req.body.state || 'draft'),
      notes: req.body.notes
    };
    
    const updated = await ordenCompraModel.update(id, poData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a purchase order
 */
async function deletePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    
    const deleted = await ordenCompraModel.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates the status of a purchase order
 */
async function updatePurchaseOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, state } = req.body;
    
    const statusToUpdate = mapStatusToSpanish(status || state);
    
    const validStatuses = ['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado'];
    if (!validStatuses.includes(statusToUpdate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const currentOrder = await ordenCompraModel.getById(id);
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }
    
    const poData = {
      ...currentOrder,
      status: statusToUpdate
    };
    
    const updated = await ordenCompraModel.update(id, poData);
    
    res.json({
      success: true,
      message: `Purchase order status updated to ${statusToUpdate}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets purchase orders by cost center
 */
async function getPurchaseOrdersByCostCenter(req, res, next) {
  try {
    const { costCenterId } = req.params;
    const options = {
      limit: req.query.limit || 100,
      status: req.query.status
    };
    
    const purchaseOrders = await ordenCompraModel.getByCostCenter(costCenterId, options);
    
    res.json({
      success: true,
      data: purchaseOrders
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets purchase order statistics
 */
async function getPurchaseOrderStats(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      costCenterId: req.query.costCenterId
    };
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const stats = await ordenCompraModel.getStats(filters);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

export {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  createPurchaseOrdersBatch,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByCostCenter,
  getPurchaseOrderStats
};