// src/controllers/cashFlowController.mjs
import { pool } from '../config/database.mjs';

/**
 * GET /api/cashflow
 * Obtener todos los registros de flujo de caja
 */
export const getAllCashFlow = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización para el usuario'
      });
    }

    const [cashflow] = await pool.query(
      `SELECT cf.*, p.name as project_name, u.name as created_by_name
       FROM cashflow cf
       LEFT JOIN projects p ON cf.project_id = p.id
       LEFT JOIN users u ON cf.created_by = u.id
       WHERE cf.organization_id = ?
       ORDER BY cf.date DESC`,
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: cashflow,
      count: cashflow.length,
      organization_id: organizationId
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener flujo de caja',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/cashflow
 * Crear nuevo registro de flujo de caja
 */
export const createCashFlow = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { project_id, type, category, amount, description, date } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO cashflow 
       (organization_id, project_id, type, category, amount, description, date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, project_id, type, category, amount, description, date, req.user.id]
    );
    
    res.status(201).json({ 
      success: true, 
      data: {
        id: result.insertId,
        organization_id: organizationId,
        ...req.body
      },
      message: 'Registro de flujo de caja creado exitosamente'
    });
  } catch (error) {
    console.error('[CashFlow] Error creating:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear registro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/cashflow/:id
 * Obtener registro específico
 */
export const getCashFlowById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    const [cashflow] = await pool.query(
      `SELECT cf.*, p.name as project_name
       FROM cashflow cf
       LEFT JOIN projects p ON cf.project_id = p.id
       WHERE cf.id = ? AND cf.organization_id = ?`,
      [id, organizationId]
    );
    
    if (cashflow.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }
    
    res.json({ success: true, data: cashflow[0] });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/cashflow/:id
 * Actualizar registro
 */
export const updateCashFlow = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const { project_id, type, category, amount, description, date } = req.body;
    
    const [existing] = await pool.query(
      'SELECT * FROM cashflow WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }
    
    await pool.query(
      `UPDATE cashflow 
       SET project_id = ?, type = ?, category = ?, amount = ?, description = ?, date = ?
       WHERE id = ? AND organization_id = ?`,
      [project_id, type, category, amount, description, date, id, organizationId]
    );
    
    res.json({ success: true, message: 'Registro actualizado exitosamente' });
  } catch (error) {
    console.error('[CashFlow] Error updating:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/cashflow/:id
 * Eliminar registro
 */
export const deleteCashFlow = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    const [result] = await pool.query(
      'DELETE FROM cashflow WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado'
      });
    }
    
    res.json({ success: true, message: 'Registro eliminado exitosamente' });
  } catch (error) {
    console.error('[CashFlow] Error deleting:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Funciones adicionales requeridas por las rutas

export const getCashFlowData = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const { startDate, endDate, type, projectId } = req.query;
    let query = 'SELECT * FROM cashflow WHERE organization_id = ?';
    const params = [organizationId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY date DESC';
    const [data] = await pool.query(query, params);
    res.json({ success: true, data, organization_id: organizationId });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCashFlowByPeriod = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [data] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') as period, type, SUM(amount) as total
       FROM cashflow 
       WHERE organization_id = ?
       GROUP BY period, type
       ORDER BY period DESC`,
      [organizationId]
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFilterOptions = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [projects] = await pool.query(
      'SELECT id, name FROM projects WHERE organization_id = ?',
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: {
        projects,
        types: ['income', 'expense'],
        categories: []
      }
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [summary] = await pool.query(
      `SELECT 
        type,
        COUNT(*) as count,
        SUM(amount) as total
       FROM cashflow 
       WHERE organization_id = ?
       GROUP BY type`,
      [organizationId]
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    // Por ahora retornamos categorías vacías, puedes crear tabla después
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Categoría creada (funcionalidad pendiente)' 
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    res.json({ success: true, message: 'Categoría actualizada (funcionalidad pendiente)' });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCashFlowLine = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, category_id, type, planned_date, amount, notes } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [result] = await pool.query(
      `INSERT INTO cashflow 
       (organization_id, type, category, amount, description, date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, type, category_id, amount, notes || name, planned_date, req.user.id]
    );
    
    res.status(201).json({ 
      success: true, 
      data: { id: result.insertId, organization_id: organizationId }
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCashFlowLine = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const { name, amount, planned_date } = req.body;
    
    await pool.query(
      'UPDATE cashflow SET description = ?, amount = ?, date = ? WHERE id = ? AND organization_id = ?',
      [name, amount, planned_date, id, organizationId]
    );
    
    res.json({ success: true, message: 'Línea actualizada' });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCashFlowLine = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    const [result] = await pool.query(
      'DELETE FROM cashflow WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Línea no encontrada' });
    }
    
    res.json({ success: true, message: 'Línea eliminada' });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectCashFlow = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [data] = await pool.query(
      'SELECT * FROM cashflow WHERE project_id = ? AND organization_id = ? ORDER BY date DESC',
      [projectId, organizationId]
    );
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCashFlowSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [summary] = await pool.query(
      `SELECT type, COUNT(*) as count, SUM(amount) as total
       FROM cashflow 
       WHERE project_id = ? AND organization_id = ?
       GROUP BY type`,
      [projectId, organizationId]
    );
    
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createIncome = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user.organizationId;
    const { name, amount, planned_date } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [result] = await pool.query(
      `INSERT INTO cashflow 
       (organization_id, project_id, type, description, amount, date, created_by) 
       VALUES (?, ?, 'income', ?, ?, ?, ?)`,
      [organizationId, projectId, name, amount, planned_date, req.user.id]
    );
    
    res.status(201).json({ 
      success: true, 
      data: { id: result.insertId, organization_id: organizationId }
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user.organizationId;
    const { name, amount, planned_date } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No se encontró organización' });
    }

    const [result] = await pool.query(
      `INSERT INTO cashflow 
       (organization_id, project_id, type, description, amount, date, created_by) 
       VALUES (?, ?, 'expense', ?, ?, ?, ?)`,
      [organizationId, projectId, name, amount, planned_date, req.user.id]
    );
    
    res.status(201).json({ 
      success: true, 
      data: { id: result.insertId, organization_id: organizationId }
    });
  } catch (error) {
    console.error('[CashFlow] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};