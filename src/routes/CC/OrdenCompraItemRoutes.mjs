// src/routes/CC/OrdenCompraItemRoutes.mjs
import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../../middleware/auth.mjs';
import { pool } from '../../config/database.mjs';
import * as itemModel from '../../models/CC/ordenCompraItemModel.mjs';
import * as ordenCompraModel from '../../models/CC/ordenCompraModel.mjs';
import * as itemController from '../../controllers/CC/ordenCompraItemController.mjs';

const router = Router();

// Helpers
function handleValidationErrors(req, res, next) {
	// express-validator result API not imported; lightweight manual check
	next();
}

// Get reference data for forms
router.get('/api/ordenes-compra/items/reference-data', authenticate, async (req, res) => {
	try {
		const costCenters = await itemModel.getCostCenters();
		const accountCategories = await itemModel.getAccountCategories();
		res.json({ 
			success: true, 
			data: { 
				costCenters, 
				accountCategories 
			} 
		});
	} catch (error) {
		console.error('❌ Error getting reference data:', error);
		res.status(500).json({ success: false, message: 'Error interno', error: error.message });
	}
});

// List items of a purchase order
router.get('/api/ordenes-compra/:poId/items', authenticate, async (req, res) => {
	try {
		const { poId } = req.params;
		const po = await ordenCompraModel.getById(poId);
		if (!po) {
			return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
		}
		const items = await itemModel.listByPurchaseOrder(poId);
		res.json({ success: true, data: items });
	} catch (error) {
		console.error('❌ Error listing PO items:', error);
		res.status(500).json({ success: false, message: 'Error interno', error: error.message });
	}
});

// Get single item
router.get('/api/ordenes-compra/items/:id', authenticate, async (req, res) => {
	try {
		const item = await itemModel.getById(req.params.id);
		if (!item) return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
		res.json({ success: true, data: item });
	} catch (error) {
		res.status(500).json({ success: false, message: 'Error interno', error: error.message });
	}
});

// Create item
router.post(
	'/api/ordenes-compra/:poId/items',
	authenticate,
	[
		body('cost_center_id').optional().isInt({ min: 1 }).withMessage('cost_center_id debe ser un entero positivo'),
		body('account_category_id').optional().isInt({ min: 1 }).withMessage('account_category_id debe ser un entero positivo'),
		body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Fecha inválida (YYYY-MM-DD)'),
		body('total').notEmpty().withMessage('total requerido').isNumeric().withMessage('total numérico'),
		body('currency').optional().isLength({ max: 10 })
	],
	async (req, res) => {
		try {
			const { poId } = req.params;
			const po = await ordenCompraModel.getById(poId);
			if (!po) return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
			const created = await itemModel.create({ ...req.body, purchase_order_id: poId });
			res.status(201).json({ success: true, data: created });
		} catch (error) {
			res.status(400).json({ success: false, message: error.message });
		}
	}
);

// Bulk create items
router.post(
	'/api/ordenes-compra/:poId/items/bulk',
	authenticate,
	[ body('items').isArray({ min: 1 }).withMessage('items array requerido') ],
	async (req, res) => {
		try {
			const { poId } = req.params;
			const po = await ordenCompraModel.getById(poId);
			if (!po) return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
			const result = await itemModel.bulkCreate(poId, req.body.items);
			res.status(201).json({ success: true, data: result });
		} catch (error) {
			res.status(400).json({ success: false, message: error.message });
		}
	}
);

// Update item
router.put(
	'/api/ordenes-compra/items/:id',
	authenticate,
	[
		body('cost_center_id').optional().isInt({ min: 1 }).withMessage('cost_center_id debe ser un entero positivo'),
		body('account_category_id').optional().isInt({ min: 1 }).withMessage('account_category_id debe ser un entero positivo'),
		body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
		body('total').optional().isNumeric(),
		body('currency').optional().isLength({ max: 10 })
	],
	async (req, res) => {
		try {
			const { id } = req.params;
			const updated = await itemModel.update(id, req.body);
			if (!updated) return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
			res.json({ success: true, data: updated });
		} catch (error) {
			res.status(400).json({ success: false, message: error.message });
		}
	}
);

// Delete item
router.delete('/api/ordenes-compra/items/:id', authenticate, async (req, res) => {
	try {
		const { id } = req.params;
		const removed = await itemModel.remove(id);
		if (!removed) return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
		res.json({ success: true, message: 'Ítem eliminado' });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

// Delete all items of a PO
router.delete('/api/ordenes-compra/:poId/items', authenticate, async (req, res) => {
	try {
		const { poId } = req.params;
		const po = await ordenCompraModel.getById(poId);
		if (!po) return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
		const count = await itemModel.removeByPurchaseOrder(poId);
		res.json({ success: true, removed: count });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

// Get totals for a PO
router.get('/api/ordenes-compra/:poId/items/totals', authenticate, async (req, res) => {
	try {
		const { poId } = req.params;
		const po = await ordenCompraModel.getById(poId);
		if (!po) return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
		const totals = await itemModel.getTotalsByPurchaseOrder(poId);
		res.json({ success: true, data: totals });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

// Get items statistics by cost center and account category
router.get('/api/ordenes-compra/:poId/items/stats', authenticate, async (req, res) => {
	try {
		const { poId } = req.params;
		const po = await ordenCompraModel.getById(poId);
		if (!po) return res.status(404).json({ success: false, message: 'Orden de compra no encontrada' });
		
		// Get detailed statistics
		const [statsByCostCenter] = await pool.query(`
			SELECT 
				poi.cost_center_id,
				cc.name as cost_center_name,
				cc.code as cost_center_code,
				COUNT(*) as items_count,
				SUM(poi.total) as total_amount
			FROM purchase_order_items poi
			LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
			WHERE poi.purchase_order_id = ?
			GROUP BY poi.cost_center_id, cc.name, cc.code
			ORDER BY total_amount DESC
		`, [poId]);

		const [statsByCategory] = await pool.query(`
			SELECT 
				poi.account_category_id,
				ac.name as category_name,
				ac.code as category_code,
				ac.group_name as category_group,
				COUNT(*) as items_count,
				SUM(poi.total) as total_amount
			FROM purchase_order_items poi
			LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
			WHERE poi.purchase_order_id = ?
			GROUP BY poi.account_category_id, ac.name, ac.code, ac.group_name
			ORDER BY total_amount DESC
		`, [poId]);

		res.json({ 
			success: true, 
			data: { 
				by_cost_center: statsByCostCenter,
				by_account_category: statsByCategory
			} 
		});
	} catch (error) {
		console.error('❌ Error getting items stats:', error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// NEW ENDPOINTS - Get items by cost center ID
router.get('/api/ordenes-compra/items/by-cost-center/:costCenterId', authenticate, itemController.getItemsByCostCenter);

// Get items by account category ID
router.get('/api/ordenes-compra/items/by-account-category/:accountCategoryId', authenticate, itemController.getItemsByAccountCategory);

// Get items by both cost center ID and account category ID
router.get('/api/ordenes-compra/items/by-cost-center-and-category/:costCenterId/:accountCategoryId', authenticate, itemController.getItemsByCostCenterAndAccountCategory);

// Get summary statistics by cost center ID
router.get('/api/ordenes-compra/items/summary/cost-center/:costCenterId', authenticate, itemController.getSummaryByCostCenter);

// Get summary statistics by account category ID
router.get('/api/ordenes-compra/items/summary/account-category/:accountCategoryId', authenticate, itemController.getSummaryByAccountCategory);

export default router;
