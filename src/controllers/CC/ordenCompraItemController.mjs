// src/controllers/CC/ordenCompraItemController.mjs
import * as OrdenCompraItemModel from '../../models/CC/ordenCompraItemModel.mjs';

/**
 * Get purchase order items by cost center ID
 */
export async function getItemsByCostCenter(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getItemsByCostCenter');

    const { costCenterId } = req.params;

    if (!costCenterId || isNaN(costCenterId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de centro de costo inválido'
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      currency: req.query.currency
    };

    const items = await OrdenCompraItemModel.getByCostCenter(costCenterId, filters);

    res.json({
      success: true,
      data: items,
      message: `Items obtenidos exitosamente para centro de costo ID: ${costCenterId}`
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getItemsByCostCenter - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los items por centro de costo',
      error: error.message
    });
  }
}

/**
 * Get purchase order items by account category ID
 */
export async function getItemsByAccountCategory(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getItemsByAccountCategory');

    const { accountCategoryId } = req.params;

    if (!accountCategoryId || isNaN(accountCategoryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría contable inválido'
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      currency: req.query.currency
    };

    const items = await OrdenCompraItemModel.getByAccountCategory(accountCategoryId, filters);

    res.json({
      success: true,
      data: items,
      message: `Items obtenidos exitosamente para categoría contable ID: ${accountCategoryId}`
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getItemsByAccountCategory - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los items por categoría contable',
      error: error.message
    });
  }
}

/**
 * Get purchase order items by both cost center ID and account category ID
 */
export async function getItemsByCostCenterAndAccountCategory(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getItemsByCostCenterAndAccountCategory');

    const { costCenterId, accountCategoryId } = req.params;

    if (!costCenterId || isNaN(costCenterId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de centro de costo inválido'
      });
    }

    if (!accountCategoryId || isNaN(accountCategoryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría contable inválido'
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      currency: req.query.currency
    };

    const items = await OrdenCompraItemModel.getByCostCenterAndAccountCategory(
      costCenterId,
      accountCategoryId,
      filters
    );

    res.json({
      success: true,
      data: items,
      message: `Items obtenidos exitosamente para centro de costo ID: ${costCenterId} y categoría contable ID: ${accountCategoryId}`
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getItemsByCostCenterAndAccountCategory - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los items por centro de costo y categoría contable',
      error: error.message
    });
  }
}

/**
 * Get summary statistics by cost center ID
 */
export async function getSummaryByCostCenter(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getSummaryByCostCenter');

    const { costCenterId } = req.params;

    if (!costCenterId || isNaN(costCenterId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de centro de costo inválido'
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const summary = await OrdenCompraItemModel.getSummaryByCostCenter(costCenterId, filters);

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos para el centro de costo especificado'
      });
    }

    res.json({
      success: true,
      data: summary,
      message: `Resumen obtenido exitosamente para centro de costo ID: ${costCenterId}`
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getSummaryByCostCenter - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen por centro de costo',
      error: error.message
    });
  }
}

/**
 * Get summary statistics by account category ID
 */
export async function getSummaryByAccountCategory(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getSummaryByAccountCategory');

    const { accountCategoryId } = req.params;

    if (!accountCategoryId || isNaN(accountCategoryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría contable inválido'
      });
    }

    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const summary = await OrdenCompraItemModel.getSummaryByAccountCategory(accountCategoryId, filters);

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron datos para la categoría contable especificada'
      });
    }

    res.json({
      success: true,
      data: summary,
      message: `Resumen obtenido exitosamente para categoría contable ID: ${accountCategoryId}`
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getSummaryByAccountCategory - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen por categoría contable',
      error: error.message
    });
  }
}

/**
 * Get all purchase order items with optional filters
 */
export async function getAllItems(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getAllItems');

    const { purchaseOrderId } = req.query;

    if (!purchaseOrderId || isNaN(purchaseOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'purchase_order_id es requerido y debe ser un número válido'
      });
    }

    const items = await OrdenCompraItemModel.listByPurchaseOrder(purchaseOrderId);

    res.json({
      success: true,
      data: items,
      message: 'Items obtenidos exitosamente'
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getAllItems - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los items',
      error: error.message
    });
  }
}

/**
 * Get purchase order item by ID
 */
export async function getItemById(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.getItemById');

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de item inválido'
      });
    }

    const item = await OrdenCompraItemModel.getById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    res.json({
      success: true,
      data: item,
      message: 'Item obtenido exitosamente'
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.getItemById - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el item',
      error: error.message
    });
  }
}

/**
 * Create new purchase order item
 */
export async function createItem(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.createItem');

    const itemData = req.body;

    // Validaciones básicas
    if (!itemData.purchase_order_id) {
      return res.status(400).json({
        success: false,
        message: 'purchase_order_id es requerido'
      });
    }

    if (!itemData.total || parseFloat(itemData.total) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'total debe ser mayor a 0'
      });
    }

    const newItem = await OrdenCompraItemModel.create(itemData);

    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Item creado exitosamente'
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.createItem - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el item',
      error: error.message
    });
  }
}

/**
 * Update purchase order item
 */
export async function updateItem(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.updateItem');

    const { id } = req.params;
    const itemData = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de item inválido'
      });
    }

    const updatedItem = await OrdenCompraItemModel.update(id, itemData);

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    res.json({
      success: true,
      data: updatedItem,
      message: 'Item actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.updateItem - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el item',
      error: error.message
    });
  }
}

/**
 * Delete purchase order item
 */
export async function deleteItem(req, res) {
  try {
    console.log('🎯 OrdenCompraItemController.deleteItem');

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de item inválido'
      });
    }

    const deleted = await OrdenCompraItemModel.remove(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Item eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ OrdenCompraItemController.deleteItem - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el item',
      error: error.message
    });
  }
}