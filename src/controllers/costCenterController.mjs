// src/controllers/costCenterController.mjs
import * as CostCenterModel from '../models/costCenterModel.mjs';

/**
 * GET /api/cost-centers
 * Get all cost centers for the organization
 */
export async function getAllCostCenters(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    const costCenters = await CostCenterModel.getAllCostCenters(organizationId);

    res.json({
      success: true,
      data: costCenters
    });
  } catch (error) {
    console.error('Error getting cost centers:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener centros de costo',
      error: error.message
    });
  }
}

/**
 * GET /api/cost-centers/:id
 * Get cost center by ID
 */
export async function getCostCenterById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const costCenter = await CostCenterModel.getCostCenterById(id, organizationId);

    if (!costCenter) {
      return res.status(404).json({
        success: false,
        message: 'Centro de costo no encontrado'
      });
    }

    res.json({
      success: true,
      data: costCenter
    });
  } catch (error) {
    console.error('Error getting cost center:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener centro de costo',
      error: error.message
    });
  }
}

/**
 * POST /api/cost-centers
 * Create a new cost center
 */
export async function createCostCenter(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    const costCenterData = {
      ...req.body,
      organization_id: organizationId,
      created_by: userId
    };

    const newId = await CostCenterModel.createCostCenter(costCenterData);

    res.status(201).json({
      success: true,
      message: 'Centro de costo creado exitosamente',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Error creating cost center:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear centro de costo',
      error: error.message
    });
  }
}

/**
 * PUT /api/cost-centers/:id
 * Update cost center
 */
export async function updateCostCenter(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    const costCenterData = {
      ...req.body,
      updated_by: userId
    };

    const affectedRows = await CostCenterModel.updateCostCenter(id, organizationId, costCenterData);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Centro de costo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Centro de costo actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error updating cost center:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar centro de costo',
      error: error.message
    });
  }
}

/**
 * DELETE /api/cost-centers/:id
 * Delete (soft delete) cost center
 */
export async function deleteCostCenter(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const affectedRows = await CostCenterModel.deleteCostCenter(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Centro de costo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Centro de costo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting cost center:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar centro de costo',
      error: error.message
    });
  }
}
