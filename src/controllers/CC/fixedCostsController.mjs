// src/controllers/CC/fixedCostsController.mjs

import * as fixedCostsModel from '../../models/CC/fixedCostsModel.mjs';

/**
 * Gets all fixed costs with optional filters and pagination
 */
async function getFixedCosts(req, res, next) {
  try {
    console.log('🔍 Getting fixed costs with query:', req.query);
    
    // Validate input parameters
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    // Parse filters
    const filters = {};
    
    if (req.query.search && req.query.search.trim()) {
      filters.search = req.query.search.trim();
    }
    
    if (req.query.state && req.query.state.trim()) {
      filters.state = req.query.state.trim();
    }
    
    if (req.query.costCenterId) {
      const costCenterId = parseInt(req.query.costCenterId);
      if (!isNaN(costCenterId)) {
        filters.costCenterId = costCenterId;
      }
    }
    
    if (req.query.categoryId) {
      const categoryId = parseInt(req.query.categoryId);
      if (!isNaN(categoryId)) {
        filters.categoryId = categoryId;
      }
    }
    
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }
    
    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }
    
    if (req.query.paymentStatus) {
      filters.paymentStatus = req.query.paymentStatus;
    }
    
    console.log('🔍 Parsed filters:', filters);
    
    // Get data from model
    const result = await fixedCostsModel.getAll(filters, { limit, offset });
    
    // Get statistics
    let stats;
    try {
      stats = await fixedCostsModel.getStats(filters);
    } catch (statsError) {
      console.error('❌ Stats error:', statsError);
      stats = {
        total: 0, draft: 0, active: 0, suspended: 0, completed: 0, cancelled: 0,
        total_amount: 0, paid_amount: 0, remaining_amount: 0, avg_quota_value: 0
      };
    }
    
    // Ensure correct structure
    if (!result || !result.data) {
      result = {
        data: [],
        pagination: {
          current_page: Math.floor(offset / limit) + 1,
          per_page: limit, total: 0, total_pages: 0,
          has_next: false, has_prev: false
        }
      };
    }
    
    // Transform data for frontend
    const transformedData = result.data.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      quota_value: parseFloat(row.quota_value) || 0,
      quota_count: parseInt(row.quota_count) || 0,
      paid_quotas: parseInt(row.paid_quotas) || 0,
      start_date: row.start_date,
      end_date: row.end_date,
      payment_date: row.payment_date,
      next_payment_date: row.next_payment_date,
      cost_center_id: row.cost_center_id,
      account_category_id: row.account_category_id,
      company_id: row.company_id,
      state: row.state,
      created_at: row.created_at,
      updated_at: row.updated_at,
      center_code: row.center_code,
      center_name: row.center_name,
      center_type: row.center_type,
      category_name: row.category_name,
      category_code: row.category_code,
      total_amount: parseFloat(row.total_amount) || 0,
      paid_amount: parseFloat(row.paid_amount) || 0,
      remaining_amount: parseFloat(row.remaining_amount) || 0,
      payment_status: row.payment_status
    }));
    
    // Transform statistics
    const transformedStats = {
      total: parseInt(stats.total) || 0,
      totalCosts: parseInt(stats.total) || 0,
      totalAmount: parseFloat(stats.total_amount) || 0,
      paidAmount: parseFloat(stats.paid_amount) || 0,
      remainingAmount: parseFloat(stats.remaining_amount) || 0,
      
      // States
      draft: parseInt(stats.draft) || 0,
      active: parseInt(stats.active) || 0,
      suspended: parseInt(stats.suspended) || 0,
      completed: parseInt(stats.completed) || 0,
      cancelled: parseInt(stats.cancelled) || 0,
      
      avgQuotaValue: parseFloat(stats.avg_quota_value) || 0
    };
    
    // Final response
    res.json({
      success: true,
      data: transformedData,
      pagination: result.pagination,
      stats: transformedStats,
      filters: filters
    });
    
  } catch (error) {
    console.error('❌ Controller error in getFixedCosts:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener costos fijos',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
      data: [],
      pagination: {
        current_page: 1,
        per_page: parseInt(req.query.limit) || 25,
        total: 0, total_pages: 0, has_next: false, has_prev: false
      },
      stats: {
        total: 0, totalCosts: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0,
        draft: 0, active: 0, suspended: 0, completed: 0, cancelled: 0, avgQuotaValue: 0
      }
    });
  }
}

/**
 * Gets a fixed cost by ID
 */
async function getFixedCostById(req, res, next) {
  try {
    const { id } = req.params;
    const fixedCost = await fixedCostsModel.getById(id);
    
    if (!fixedCost) {
      return res.status(404).json({
        success: false,
        message: 'Fixed cost not found'
      });
    }
    
    // Transform data for frontend
    const transformedData = {
      id: fixedCost.id,
      name: fixedCost.name,
      description: fixedCost.description,
      quota_value: parseFloat(fixedCost.quota_value) || 0,
      quota_count: parseInt(fixedCost.quota_count) || 0,
      paid_quotas: parseInt(fixedCost.paid_quotas) || 0,
      start_date: fixedCost.start_date,
      end_date: fixedCost.end_date,
      payment_date: fixedCost.payment_date,
      next_payment_date: fixedCost.next_payment_date,
      cost_center_id: fixedCost.cost_center_id,
      account_category_id: fixedCost.account_category_id,
      state: fixedCost.state,
      created_at: fixedCost.created_at,
      updated_at: fixedCost.updated_at,
      center_code: fixedCost.center_code,
      center_name: fixedCost.center_name,
      category_name: fixedCost.category_name,
      total_amount: parseFloat(fixedCost.total_amount) || 0,
      paid_amount: parseFloat(fixedCost.paid_amount) || 0,
      remaining_amount: parseFloat(fixedCost.remaining_amount) || 0
    };
    
    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new fixed cost
 */
async function createFixedCost(req, res, next) {
  try {
    console.log('📤 Creating fixed cost:', req.body);
    
    // Validate required fields
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
        field: 'name'
      });
    }
    
    if (!req.body.quota_value || parseFloat(req.body.quota_value) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quota value must be greater than zero',
        field: 'quota_value'
      });
    }
    
    if (!req.body.quota_count || parseInt(req.body.quota_count) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quota count must be greater than zero',
        field: 'quota_count'
      });
    }
    
    if (!req.body.start_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required',
        field: 'start_date'
      });
    }
    
    // Create fixed cost
    const result = await fixedCostsModel.create({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || null,
      quota_value: parseFloat(req.body.quota_value),
      quota_count: parseInt(req.body.quota_count),
      paid_quotas: parseInt(req.body.paid_quotas) || 0,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      payment_date: req.body.payment_date || req.body.start_date,
      cost_center_id: req.body.cost_center_id || req.body.projectId,
      account_category_id: req.body.account_category_id,
      center_code: req.body.center_code,
      category_name: req.body.category_name,
      company_id: req.user?.company_id || 1,
      state: req.body.state || 'active'
    });
    
    console.log('✅ Fixed cost created successfully:', result.id);
    
    res.status(201).json({
      success: true,
      message: 'Fixed cost created successfully',
      data: { id: result.id }
    });
    
  } catch (error) {
    console.error('❌ Error creating fixed cost:', error);
    
    // Handle specific database errors
    if (error.code === 'ER_BAD_NULL_ERROR') {
      return res.status(400).json({
        success: false,
        message: 'Required field is missing',
        error: error.message
      });
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Referenced cost center or category does not exist'
      });
    }
    
    next(error);
  }
}

/**
 * Updates an existing fixed cost
 */
async function updateFixedCost(req, res, next) {
  try {
    const { id } = req.params;
    
    console.log('📤 Updating fixed cost:', id, req.body);
    
    const updated = await fixedCostsModel.update(id, {
      name: req.body.name,
      description: req.body.description,
      quota_value: req.body.quota_value,
      quota_count: req.body.quota_count,
      paid_quotas: req.body.paid_quotas,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      payment_date: req.body.payment_date,
      cost_center_id: req.body.cost_center_id || req.body.projectId,
      account_category_id: req.body.account_category_id,
      center_code: req.body.center_code,
      category_name: req.body.category_name,
      state: req.body.state
    });
    
    res.json({
      success: true,
      message: 'Fixed cost updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a fixed cost
 */
async function deleteFixedCost(req, res, next) {
  try {
    const { id } = req.params;
    
    const deleted = await fixedCostsModel.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Fixed cost not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Fixed cost deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates paid quotas for a fixed cost
 */
async function updatePaidQuotas(req, res, next) {
  try {
    const { id } = req.params;
    const { paid_quotas } = req.body;
    
    if (paid_quotas === undefined || isNaN(parseInt(paid_quotas))) {
      return res.status(400).json({
        success: false,
        message: 'Valid paid_quotas value is required'
      });
    }
    
    const updated = await fixedCostsModel.updatePaidQuotas(id, parseInt(paid_quotas));
    
    res.json({
      success: true,
      message: 'Paid quotas updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets fixed costs by cost center
 */
async function getFixedCostsByCostCenter(req, res, next) {
  try {
    const { costCenterId } = req.params;
    const options = {
      limit: req.query.limit || 100,
      state: req.query.state
    };
    
    const fixedCosts = await fixedCostsModel.getByCostCenter(costCenterId, options);
    
    res.json({
      success: true,
      data: fixedCosts
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets fixed costs statistics
 */
async function getFixedCostsStats(req, res, next) {
  try {
    const filters = {
      search: req.query.search,
      state: req.query.state,
      costCenterId: req.query.costCenterId
    };
    
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });
    
    const stats = await fixedCostsModel.getStats(filters);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

export {
  getFixedCosts,
  getFixedCostById,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  updatePaidQuotas,
  getFixedCostsByCostCenter,
  getFixedCostsStats
};