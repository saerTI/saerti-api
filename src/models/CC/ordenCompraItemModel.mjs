import { pool } from '../../config/database.mjs';

// Campos de purchase_order_items:
// id, purchase_order_id, cost_center_id, account_category_id, date, description, glosa, currency, total, created_at, updated_at

function normalizeDate(d) {
	if (!d) return new Date().toISOString().split('T')[0];
	if (d instanceof Date) return d.toISOString().split('T')[0];
	if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
	const parsed = new Date(d);
	if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
	return new Date().toISOString().split('T')[0];
}

async function listByPurchaseOrder(purchaseOrderId) {
	const [rows] = await pool.query(
		`SELECT poi.*, 
		        cc.name as cost_center_name, cc.code as cost_center_code,
		        ac.name as account_category_name, ac.code as account_category_code
		 FROM purchase_order_items poi
		 LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		 LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		 WHERE poi.purchase_order_id = ? 
		 ORDER BY poi.date ASC, poi.id ASC`,
		[purchaseOrderId]
	);
	return rows;
}

async function getById(id) {
	const [rows] = await pool.query(
		`SELECT poi.*, 
		        cc.name as cost_center_name, cc.code as cost_center_code,
		        ac.name as account_category_name, ac.code as account_category_code
		 FROM purchase_order_items poi
		 LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		 LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		 WHERE poi.id = ? LIMIT 1`,
		[id]
	);
	return rows[0] || null;
}

async function create(item) {
	const data = {
		purchase_order_id: item.purchase_order_id,
		cost_center_id: item.cost_center_id ? parseInt(item.cost_center_id) : null,
		account_category_id: item.account_category_id ? parseInt(item.account_category_id) : null,
		date: normalizeDate(item.date),
		description: item.description?.trim() || null,
		glosa: item.glosa?.trim() || null,
		currency: item.currency?.trim() || 'CLP',
		total: parseFloat(item.total) || 0
	};

	if (!data.purchase_order_id) {
		throw new Error('purchase_order_id es requerido');
	}
	if (data.total <= 0) {
		throw new Error('total debe ser mayor a 0');
	}

	const [result] = await pool.query(
		`INSERT INTO purchase_order_items (purchase_order_id, cost_center_id, account_category_id, date, description, glosa, currency, total)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[data.purchase_order_id, data.cost_center_id, data.account_category_id, data.date, data.description, data.glosa, data.currency, data.total]
	);
	return { id: result.insertId, ...data };
}

async function bulkCreate(purchase_order_id, items = []) {
	if (!purchase_order_id) throw new Error('purchase_order_id requerido');
	if (!Array.isArray(items) || items.length === 0) return [];

	const values = [];
	const params = [];
	for (const raw of items) {
		const cost_center_id = raw.cost_center_id ? parseInt(raw.cost_center_id) : null;
		const account_category_id = raw.account_category_id ? parseInt(raw.account_category_id) : null;
		const date = normalizeDate(raw.date);
		const description = raw.description?.trim() || null;
		const glosa = raw.glosa?.trim() || null;
		const currency = raw.currency?.trim() || 'CLP';
		const total = parseFloat(raw.total) || 0;
		if (total <= 0) continue;
		values.push('(?, ?, ?, ?, ?, ?, ?, ?)');
		params.push(purchase_order_id, cost_center_id, account_category_id, date, description, glosa, currency, total);
	}
	if (values.length === 0) return [];
	const [result] = await pool.query(
		`INSERT INTO purchase_order_items (purchase_order_id, cost_center_id, account_category_id, date, description, glosa, currency, total) VALUES ${values.join(',')}`,
		params
	);
	return { inserted: values.length, firstInsertId: result.insertId };
}

async function update(id, item) {
	const existing = await getById(id);
	if (!existing) return null;

	const data = {
		cost_center_id: item.cost_center_id !== undefined ? (item.cost_center_id ? parseInt(item.cost_center_id) : null) : existing.cost_center_id,
		account_category_id: item.account_category_id !== undefined ? (item.account_category_id ? parseInt(item.account_category_id) : null) : existing.account_category_id,
		date: normalizeDate(item.date || existing.date),
		description: item.description !== undefined ? item.description?.trim() || null : existing.description,
		glosa: item.glosa !== undefined ? item.glosa?.trim() || null : existing.glosa,
		currency: item.currency?.trim() || existing.currency,
		total: item.total !== undefined ? (parseFloat(item.total) || 0) : existing.total
	};

	if (data.total <= 0) {
		throw new Error('total debe ser mayor a 0');
	}

	await pool.query(
		`UPDATE purchase_order_items SET cost_center_id = ?, account_category_id = ?, date = ?, description = ?, glosa = ?, currency = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		[data.cost_center_id, data.account_category_id, data.date, data.description, data.glosa, data.currency, data.total, id]
	);
	return { id, purchase_order_id: existing.purchase_order_id, ...data };
}

async function remove(id) {
	const [result] = await pool.query(
		`DELETE FROM purchase_order_items WHERE id = ?`,
		[id]
	);
	return result.affectedRows > 0;
}

async function removeByPurchaseOrder(purchase_order_id) {
	const [result] = await pool.query(
		`DELETE FROM purchase_order_items WHERE purchase_order_id = ?`,
		[purchase_order_id]
	);
	return result.affectedRows;
}

async function getTotalsByPurchaseOrder(purchase_order_id) {
	const [rows] = await pool.query(
		`SELECT purchase_order_id, COALESCE(SUM(total),0) as amount
		 FROM purchase_order_items WHERE purchase_order_id = ? GROUP BY purchase_order_id`,
		[purchase_order_id]
	);
	return rows[0] || { purchase_order_id, amount: 0 };
}

// Nuevas funciones para obtener listas de referencia
async function getCostCenters() {
	const [rows] = await pool.query(
		`SELECT id, code, name, type, status FROM cost_centers WHERE status = 'activo' ORDER BY name ASC`
	);
	return rows;
}

async function getAccountCategories() {
	const [rows] = await pool.query(
		`SELECT id, code, name, type, group_name FROM account_categories WHERE active = 1 ORDER BY group_name ASC, name ASC`
	);
	return rows;
}

// Nuevas funciones para filtrar por cost_center_id y account_category_id
async function getByCostCenter(costCenterId, filters = {}) {
	let query = `
		SELECT poi.*,
		       cc.name as cost_center_name, cc.code as cost_center_code,
		       ac.name as account_category_name, ac.code as account_category_code,
		       po.po_number as purchase_order_number, po.po_date as purchase_order_date
		FROM purchase_order_items poi
		LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
		WHERE poi.cost_center_id = ?
	`;

	let params = [costCenterId];

	// Filtros adicionales
	if (filters.date_from) {
		query += ` AND poi.date >= ?`;
		params.push(filters.date_from);
	}

	if (filters.date_to) {
		query += ` AND poi.date <= ?`;
		params.push(filters.date_to);
	}

	if (filters.currency) {
		query += ` AND poi.currency = ?`;
		params.push(filters.currency);
	}

	query += ` ORDER BY poi.date DESC, poi.id DESC`;

	const [rows] = await pool.query(query, params);
	return rows;
}

async function getByAccountCategory(accountCategoryId, filters = {}) {
	let query = `
		SELECT poi.*,
		       cc.name as cost_center_name, cc.code as cost_center_code,
		       ac.name as account_category_name, ac.code as account_category_code,
		       po.po_number as purchase_order_number, po.po_date as purchase_order_date
		FROM purchase_order_items poi
		LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
		WHERE poi.account_category_id = ?
	`;

	let params = [accountCategoryId];

	// Filtros adicionales
	if (filters.date_from) {
		query += ` AND poi.date >= ?`;
		params.push(filters.date_from);
	}

	if (filters.date_to) {
		query += ` AND poi.date <= ?`;
		params.push(filters.date_to);
	}

	if (filters.currency) {
		query += ` AND poi.currency = ?`;
		params.push(filters.currency);
	}

	query += ` ORDER BY poi.date DESC, poi.id DESC`;

	const [rows] = await pool.query(query, params);
	return rows;
}

async function getByCostCenterAndAccountCategory(costCenterId, accountCategoryId, filters = {}) {
	let query = `
		SELECT poi.*,
		       cc.name as cost_center_name, cc.code as cost_center_code,
		       ac.name as account_category_name, ac.code as account_category_code,
		       po.po_number as purchase_order_number, po.po_date as purchase_order_date
		FROM purchase_order_items poi
		LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		LEFT JOIN purchase_orders po ON poi.purchase_order_id = po.id
		WHERE poi.cost_center_id = ? AND poi.account_category_id = ?
	`;

	let params = [costCenterId, accountCategoryId];

	// Filtros adicionales
	if (filters.date_from) {
		query += ` AND poi.date >= ?`;
		params.push(filters.date_from);
	}

	if (filters.date_to) {
		query += ` AND poi.date <= ?`;
		params.push(filters.date_to);
	}

	if (filters.currency) {
		query += ` AND poi.currency = ?`;
		params.push(filters.currency);
	}

	query += ` ORDER BY poi.date DESC, poi.id DESC`;

	const [rows] = await pool.query(query, params);
	return rows;
}

// Función para obtener resúmenes y estadísticas
async function getSummaryByCostCenter(costCenterId, filters = {}) {
	let query = `
		SELECT
			poi.cost_center_id,
			cc.name as cost_center_name,
			cc.code as cost_center_code,
			COUNT(poi.id) as total_items,
			SUM(poi.total) as total_amount,
			AVG(poi.total) as average_amount,
			MIN(poi.date) as first_date,
			MAX(poi.date) as last_date,
			GROUP_CONCAT(DISTINCT poi.currency) as currencies
		FROM purchase_order_items poi
		LEFT JOIN cost_centers cc ON poi.cost_center_id = cc.id
		WHERE poi.cost_center_id = ?
	`;

	let params = [costCenterId];

	if (filters.date_from) {
		query += ` AND poi.date >= ?`;
		params.push(filters.date_from);
	}

	if (filters.date_to) {
		query += ` AND poi.date <= ?`;
		params.push(filters.date_to);
	}

	query += ` GROUP BY poi.cost_center_id, cc.name, cc.code`;

	const [rows] = await pool.query(query, params);
	return rows[0] || null;
}

async function getSummaryByAccountCategory(accountCategoryId, filters = {}) {
	let query = `
		SELECT
			poi.account_category_id,
			ac.name as account_category_name,
			ac.code as account_category_code,
			ac.type as account_category_type,
			COUNT(poi.id) as total_items,
			SUM(poi.total) as total_amount,
			AVG(poi.total) as average_amount,
			MIN(poi.date) as first_date,
			MAX(poi.date) as last_date,
			GROUP_CONCAT(DISTINCT poi.currency) as currencies
		FROM purchase_order_items poi
		LEFT JOIN account_categories ac ON poi.account_category_id = ac.id
		WHERE poi.account_category_id = ?
	`;

	let params = [accountCategoryId];

	if (filters.date_from) {
		query += ` AND poi.date >= ?`;
		params.push(filters.date_from);
	}

	if (filters.date_to) {
		query += ` AND poi.date <= ?`;
		params.push(filters.date_to);
	}

	query += ` GROUP BY poi.account_category_id, ac.name, ac.code, ac.type`;

	const [rows] = await pool.query(query, params);
	return rows[0] || null;
}

export {
	listByPurchaseOrder,
	getById,
	create,
	bulkCreate,
	update,
	remove,
	removeByPurchaseOrder,
	getTotalsByPurchaseOrder,
	getCostCenters,
	getAccountCategories,
	getByCostCenter,
	getByAccountCategory,
	getByCostCenterAndAccountCategory,
	getSummaryByCostCenter,
	getSummaryByAccountCategory
};
