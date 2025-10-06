// src/controllers/CC/incomeController.mjs
import { validationResult } from 'express-validator';
import * as incomeModel from '../models/incomeModel.mjs';

/**
 * Gets paginated incomes with filters
 */
async function getIncomes(req, res, next) {
  try {
    console.log('📥 Getting incomes with query params:', req.query);
    
    // ✅ PROCESAR PARÁMETROS
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    
    // ✅ PROCESAR FILTROS
    const filters = {
      search: req.query.search?.trim() || null,
      state: req.query.state || null,
      costCenterId: req.query.costCenterId || null,
      categoryId: req.query.categoryId || null,
      clientId: req.query.clientId || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : null,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : null,
      paymentType: req.query.paymentType || null,
      factoring: req.query.factoring || null
    };
    
    // Limpiar filtros vacíos
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });
    
    console.log('🔍 Active filters:', filters);
    
    // ✅ OBTENER DATOS Y ESTADÍSTICAS
    const result = await incomeModel.getAll(filters, { page, limit, offset });
    const stats = await incomeModel.getStats(filters);
    
    console.log('📊 Found', result.data.length, 'incomes of', result.pagination.total);
    
    // ✅ TRANSFORMAR DATOS PARA EL FRONTEND
    const transformedData = result.data.map(row => ({
      id: row.id,
      document_number: row.document_number,
      ep_detail: row.ep_detail,
      client_name: row.client_name,
      client_tax_id: row.client_tax_id,
      ep_value: parseFloat(row.ep_value) || 0,
      adjustments: parseFloat(row.adjustments) || 0,
      ep_total: parseFloat(row.ep_total) || 0,
      fine: parseFloat(row.fine) || 0,
      retention: parseFloat(row.retention) || 0,
      advance: parseFloat(row.advance) || 0,
      exempt: parseFloat(row.exempt) || 0,
      net_amount: parseFloat(row.net_amount) || 0,
      tax_amount: parseFloat(row.tax_amount) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      factoring: row.factoring,
      payment_date: row.payment_date,
      factoring_due_date: row.factoring_due_date,
      state: row.state,
      payment_status: row.payment_status,
      date: row.date,
      cost_center_code: row.cost_center_code,
      center_name: row.center_name,
      project_name: row.project_name,
      category_id: row.category_id,
      category_name: row.category_name,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    // ✅ TRANSFORMAR ESTADÍSTICAS
    const transformedStats = {
      total: parseInt(stats.total) || 0,
      borrador: parseInt(stats.borrador) || 0,
      activo: parseInt(stats.activo) || 0,
      facturado: parseInt(stats.facturado) || 0,
      pagado: parseInt(stats.pagado) || 0,
      cancelado: parseInt(stats.cancelado) || 0,
      monto_total: parseFloat(stats.monto_total) || 0,
      monto_promedio: parseFloat(stats.monto_promedio) || 0,
      
      // Mapear a nombres que espera el frontend
      totalIngresos: parseInt(stats.total) || 0,
      montoTotal: parseFloat(stats.monto_total) || 0,
      
      // Estados para el frontend
      draft: parseInt(stats.borrador) || 0,
      active: parseInt(stats.activo) || 0,
      invoiced: parseInt(stats.facturado) || 0,
      paid: parseInt(stats.pagado) || 0,
      cancelled: parseInt(stats.cancelado) || 0,
      
      // Tipos de pago
      factoringCount: parseInt(stats.factoring_count) || 0,
      transferCount: parseInt(stats.transfer_count) || 0,
      
      // Agrupaciones
      porCliente: stats.por_cliente || {},
      porCentro: stats.por_centro || {}
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
    console.error('❌ Controller error in getIncomes:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener ingresos',
      error: process.env.NODE_ENV === 'development' ? 
        error.message : 'Error interno del servidor',
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
        totalIngresos: 0,
        montoTotal: 0,
        borrador: 0,
        activo: 0,
        facturado: 0,
        pagado: 0,
        cancelado: 0,
        draft: 0,
        active: 0,
        invoiced: 0,
        paid: 0,
        cancelled: 0,
        factoringCount: 0,
        transferCount: 0,
        porCliente: {},
        porCentro: {}
      }
    });
  }
}

/**
 * Gets an income by ID
 */
async function getIncomeById(req, res, next) {
  try {
    console.log('🔍 Getting income by ID:', req.params.id);
    const { id } = req.params;
    const income = await incomeModel.getById(id);
    
    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Income not found'
      });
    }

    console.log('📄 Income raw data:', income);
    console.log('📄 Income category_id:', income.category_id);
    console.log('📄 Income category_name:', income.category_name);
    
    // ✅ TRANSFORMAR DATOS PARA EL FRONTEND
    const transformedData = {
      id: income.id,
      document_number: income.document_number,
      ep_detail: income.ep_detail,
      client_name: income.client_name,
      client_tax_id: income.client_tax_id,
      ep_value: parseFloat(income.ep_value) || 0,
      adjustments: parseFloat(income.adjustments) || 0,
      ep_total: parseFloat(income.ep_total) || 0,
      fine: parseFloat(income.fine) || 0,
      retention: parseFloat(income.retention) || 0,
      advance: parseFloat(income.advance) || 0,
      exempt: parseFloat(income.exempt) || 0,
      net_amount: parseFloat(income.net_amount) || 0,
      tax_amount: parseFloat(income.tax_amount) || 0,
      total_amount: parseFloat(income.total_amount) || 0,
      factoring: income.factoring,
      payment_date: income.payment_date,
      factoring_due_date: income.factoring_due_date,
      state: income.state,
      payment_status: income.payment_status,
      date: income.date,
      cost_center_id: income.cost_center_id,
      cost_center_code: income.cost_center_code,
      center_name: income.center_name,
      project_name: income.project_name,
      category_id: income.category_id, // ✅ AGREGADO
      category_name: income.category_name, // ✅ AGREGADO
      description: income.description,
      notes: income.notes,
      created_at: income.created_at,
      updated_at: income.updated_at
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
 * Creates a new individual income
 */
async function createIncome(req, res, next) {
  try {
    console.log('📤 Creating individual income:', req.body);
    
    // ✅ VALIDAR ENTRADA
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }
    
    // ✅ MAPEO DE CAMPOS
    const incomeData = {
      document_number: req.body.document_number?.trim(),
      ep_detail: req.body.ep_detail?.trim() || '',
      client_name: req.body.client_name?.trim(),
      client_tax_id: req.body.client_tax_id?.trim(),
      ep_value: parseFloat(req.body.ep_value) || 0,
      adjustments: parseFloat(req.body.adjustments) || 0,
      ep_total: parseFloat(req.body.ep_total) || 0,
      fine: parseFloat(req.body.fine) || 0,
      retention: parseFloat(req.body.retention) || 0,
      advance: parseFloat(req.body.advance) || 0,
      exempt: parseFloat(req.body.exempt) || 0,
      net_amount: parseFloat(req.body.net_amount) || 0,
      tax_amount: parseFloat(req.body.tax_amount) || 0,
      total_amount: parseFloat(req.body.total_amount) || parseFloat(req.body.ep_total) || 0,
      factoring: req.body.factoring?.trim() || null,
      payment_date: req.body.payment_date || null,
      factoring_due_date: req.body.factoring_due_date || null,
      state: req.body.state || 'borrador',
      payment_status: req.body.payment_status || 'no_pagado',
      date: req.body.date,
      cost_center_code: req.body.cost_center_code?.trim() || null,
      category_id: req.body.category_id || null, // ✅ AGREGADO
      description: req.body.description?.trim() || '',
      notes: req.body.notes?.trim() || '',
      created_by: req.user.id
    };
    
    console.log('📝 Final income data:', incomeData);
    
    const newIncome = await incomeModel.create(incomeData);
    
    console.log('✅ Income created successfully:', newIncome.id);
    
    res.status(201).json({
      success: true,
      message: 'Ingreso creado exitosamente',
      data: newIncome
    });
    
  } catch (error) {
    console.error('❌ Error creating income:', error);
    next(error);
  }
}

/**
 * Creates multiple incomes in batch
 */
async function createIncomesBatch(req, res, next) {
  try {
    console.log('📤 Creating batch incomes, count:', req.body.length);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Error de validación en lote',
        errors: errors.array()
      });
    }
    
    const incomesData = req.body;
    const createdIds = [];
    const updatedIds = [];
    const errorsList = [];
    
    console.log('🔄 Processing', incomesData.length, 'incomes...');
    
    for (let index = 0; index < incomesData.length; index++) {
      try {
        const item = incomesData[index];
        
        // ✅ MAPEO FLEXIBLE DE CAMPOS
        const documentNumber = item.document_number || item.documentNumber || item.numero_documento;
        const date = item.date || item.fecha;
        const epDetail = item.ep_detail || item.epDetail || item.detalle;
        const clientName = item.client_name || item.clientName || item.mandante || item.cliente;
        const clientTaxId = item.client_tax_id || item.clientTaxId || item.rut;
        const epTotal = parseFloat(item.ep_total || item.epTotal || item.total_ep || item.valor_ep) || 0;
        
        // ✅ VALIDACIONES CRÍTICAS
        if (!documentNumber || documentNumber.toString().trim() === '') {
          throw new Error('Número de documento es requerido');
        }
        
        if (!clientName || clientName.toString().trim() === '') {
          throw new Error('Nombre del cliente es requerido');
        }
        
        if (!clientTaxId || clientTaxId.toString().trim() === '') {
          throw new Error('RUT del cliente es requerido');
        }
        
        if (epTotal <= 0) {
          throw new Error('Total EP debe ser mayor a cero');
        }
        
        const incomeData = {
          document_number: documentNumber.toString().trim(),
          ep_detail: epDetail?.toString().trim() || '',
          client_name: clientName.toString().trim(),
          client_tax_id: clientTaxId.toString().trim(),
          ep_value: parseFloat(item.ep_value || item.valor_ep) || epTotal,
          adjustments: parseFloat(item.adjustments || item.reajustes) || 0,
          ep_total: epTotal,
          fine: parseFloat(item.fine || item.multa) || 0,
          retention: parseFloat(item.retention || item.retencion) || 0,
          advance: parseFloat(item.advance || item.anticipo) || 0,
          exempt: parseFloat(item.exempt || item.exento) || 0,
          net_amount: parseFloat(item.net_amount || item.neto) || 0,
          tax_amount: parseFloat(item.tax_amount || item.iva) || 0,
          total_amount: parseFloat(item.total_amount || item.total) || epTotal,
          factoring: item.factoring?.toString().trim() || null,
          payment_date: item.payment_date || item.fecha_pago || null,
          factoring_due_date: item.factoring_due_date || item.fecha_vencimiento_factoring || null,
          state: mapStatusToSpanish(item.state || item.estado || 'borrador'),
          payment_status: mapPaymentStatusToSpanish(item.payment_status || item.estado_pago || 'no_pagado'),
          date: date,
          cost_center_code: item.cost_center_code || item.cod_obra || null,
          category_id: item.category_id || null, // ✅ AGREGADO
          description: item.description || item.nombre_faena || '',
          notes: item.notes || `Importado en lote - ${new Date().toISOString()}`,
          created_by: req.user.id
        };
        
        console.log(`📋 Creating/Updating income ${index + 1}/${incomesData.length}: ${incomeData.document_number}`);
        
        const result = await incomeModel.create(incomeData);
        
        // ✅ SEPARAR CREACIONES DE ACTUALIZACIONES
        if (result.isUpdate) {
          updatedIds.push(result.id);
        } else {
          createdIds.push(result.id);
        }
        
      } catch (itemError) {
        console.error(`❌ Error processing income ${index + 1}:`, itemError);
        errorsList.push({
          index: index + 1,
          item: incomesData[index],
          error: itemError.message
        });
      }
    }
    
    console.log('✅ Batch processing completed');
    console.log(`📊 Created: ${createdIds.length}, Updated: ${updatedIds.length}, Errors: ${errorsList.length}`);
    
    res.status(201).json({
      success: true,
      message: `Procesamiento en lote completado. Creados: ${createdIds.length}, Actualizados: ${updatedIds.length}, Errores: ${errorsList.length}`,
      data: {
        created: createdIds,
        updated: updatedIds,
        errors: errorsList,
        summary: {
          total_processed: incomesData.length,
          successful: createdIds.length + updatedIds.length,
          failed: errorsList.length,
          created_count: createdIds.length,
          updated_count: updatedIds.length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in batch income creation:', error);
    next(error);
  }
}

/**
 * Updates an income
 */
async function updateIncome(req, res, next) {
  try {
    console.log('📝 Updating income:', req.params.id, req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const updateData = req.body;
    
    // Preparar datos para actualización
    const cleanedData = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        cleanedData[key] = updateData[key];
      }
    });
    
    cleanedData.updated_by = req.user.id;
    
    const updated = await incomeModel.update(id, cleanedData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Income not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Ingreso actualizado exitosamente',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes an income
 */
async function deleteIncome(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await incomeModel.deleteIncome(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Income not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Ingreso eliminado exitosamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates only the status of an income
 */
async function updateIncomeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { state } = req.body;
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }
    
    const updated = await incomeModel.updateStatus(id, state);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Income not found'
      });
    }
    
    res.json({
      success: true,
      message: `Estado del ingreso actualizado a ${state}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets incomes by cost center
 */
async function getIncomesByCostCenter(req, res, next) {
  try {
    const { costCenterId } = req.params;
    const options = {
      limit: req.query.limit || 100,
      state: req.query.state
    };
    
    const incomes = await incomeModel.getByCostCenter(costCenterId, options);
    
    res.json({
      success: true,
      data: incomes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets income statistics
 */
async function getIncomeStats(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      state: req.query.state,
      costCenterId: req.query.costCenterId,
      clientId: req.query.clientId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const stats = await incomeModel.getStats(filters);
    
    // ✅ TRANSFORMAR ESTADÍSTICAS PARA EL FRONTEND
    const transformedStats = {
      total: parseInt(stats.total) || 0,
      borrador: parseInt(stats.borrador) || 0,
      activo: parseInt(stats.activo) || 0,
      facturado: parseInt(stats.facturado) || 0,
      pagado: parseInt(stats.pagado) || 0,
      cancelado: parseInt(stats.cancelado) || 0,
      monto_total: parseFloat(stats.monto_total) || 0,
      monto_promedio: parseFloat(stats.monto_promedio) || 0,
      
      // Mapear a nombres que espera el frontend
      totalIngresos: parseInt(stats.total) || 0,
      montoTotal: parseFloat(stats.monto_total) || 0,
      
      // Estados para el frontend
      draft: parseInt(stats.borrador) || 0,
      active: parseInt(stats.activo) || 0,
      invoiced: parseInt(stats.facturado) || 0,
      paid: parseInt(stats.pagado) || 0,
      cancelled: parseInt(stats.cancelado) || 0,
      
      // Tipos de pago
      factoringCount: parseInt(stats.factoring_count) || 0,
      transferCount: parseInt(stats.transfer_count) || 0,
      
      // Agrupaciones
      porCliente: stats.por_cliente || {},
      porCentro: stats.por_centro || {}
    };
    
    res.json({
      success: true,
      data: transformedStats
    });
  } catch (error) {
    next(error);
  }
}

// Helper functions
function mapStatusToSpanish(status) {
  const statusMap = {
    'draft': 'borrador',
    'active': 'activo',
    'invoiced': 'facturado',
    'paid': 'pagado',
    'cancelled': 'cancelado',
    'borrador': 'borrador',
    'activo': 'activo',
    'facturado': 'facturado',
    'pagado': 'pagado',
    'cancelado': 'cancelado'
  };
  
  return statusMap[status?.toLowerCase()] || 'borrador';
}

function mapPaymentStatusToSpanish(paymentStatus) {
  const statusMap = {
    'unpaid': 'no_pagado',
    'partial': 'pago_parcial',
    'paid': 'pagado',
    'no_pagado': 'no_pagado',
    'pago_parcial': 'pago_parcial',
    'pagado': 'pagado'
  };
  
  return statusMap[paymentStatus?.toLowerCase()] || 'no_pagado';
}

/**
 * Get all active cost centers
 */
async function getCostCenters(req, res, next) {
  try {
    console.log('📥 Getting cost centers');
    
    const costCenters = await incomeModel.getCostCenters();
    
    console.log(`✅ Found ${costCenters.length} cost centers`);
    
    res.json(costCenters);
    
  } catch (error) {
    console.error('❌ Error getting cost centers:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

export {
  getIncomes,
  getIncomeById,
  createIncome,
  createIncomesBatch,
  updateIncome,
  deleteIncome,
  updateIncomeStatus,
  getIncomesByCostCenter,
  getIncomeStats,
  getCostCenters
};