// src/controllers/projectController.mjs

import { pool } from "../config/database.mjs";

/**
 * GET /api/projects
 * Obtener todos los proyectos (filtrado por organización)
 */
export const getAllProjects = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización para el usuario'
      });
    }

    const [projects] = await pool.query(
      `SELECT p.*, u.name as created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.organization_id = ?
       ORDER BY p.created_at DESC`,
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: projects,
      count: projects.length,
      organization_id: organizationId
    });
  } catch (error) {
    console.error('[Projects] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener proyectos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/projects
 * Crear nuevo proyecto
 */
export const createProject = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, description, start_date, end_date, budget, status } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO projects 
       (organization_id, name, description, start_date, end_date, budget, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, name, description, start_date, end_date, budget, status || 'planning', req.user.id]
    );
    
    res.status(201).json({ 
      success: true, 
      data: {
        id: result.insertId,
        organization_id: organizationId,
        ...req.body
      },
      message: 'Proyecto creado exitosamente'
    });
  } catch (error) {
    console.error('[Projects] Error creating:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear proyecto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/projects/:id
 * Obtener proyecto específico
 */
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    const [projects] = await pool.query(
      `SELECT p.*, u.name as created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ? AND p.organization_id = ?`,
      [id, organizationId]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o no pertenece a tu organización'
      });
    }
    
    res.json({ success: true, data: projects[0] });
  } catch (error) {
    console.error('[Projects] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/projects/:id
 * Actualizar proyecto
 */
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const { name, description, start_date, end_date, budget, status } = req.body;
    
    const [existing] = await pool.query(
      'SELECT * FROM projects WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }
    
    await pool.query(
      `UPDATE projects 
       SET name = ?, description = ?, start_date = ?, end_date = ?, budget = ?, status = ?
       WHERE id = ? AND organization_id = ?`,
      [name, description, start_date, end_date, budget, status, id, organizationId]
    );
    
    res.json({ success: true, message: 'Proyecto actualizado exitosamente' });
  } catch (error) {
    console.error('[Projects] Error updating:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/projects/:id
 * Eliminar proyecto
 */
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    
    const [result] = await pool.query(
      'DELETE FROM projects WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }
    
    res.json({ success: true, message: 'Proyecto eliminado exitosamente' });
  } catch (error) {
    console.error('[Projects] Error deleting:', error);
    res.status(500).json({ success: false, message: error.message });
  }

  
};

// Alias para mantener compatibilidad con las rutas
export const getProjects = getAllProjects;
export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización'
      });
    }
    
    const [existing] = await pool.query(
      'SELECT * FROM projects WHERE id = ? AND organization_id = ?',
      [id, organizationId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }
    
    await pool.query(
      'UPDATE projects SET status = ? WHERE id = ? AND organization_id = ?',
      [status, id, organizationId]
    );
    
    res.json({ 
      success: true, 
      message: 'Estado del proyecto actualizado exitosamente' 
    });
  } catch (error) {
    console.error('[Projects] Error updating status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectStatusSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización'
      });
    }
    
    const [summary] = await pool.query(
      `SELECT 
         status,
         COUNT(*) as count,
         SUM(budget) as total_budget
       FROM projects 
       WHERE organization_id = ?
       GROUP BY status`,
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: summary,
      organization_id: organizationId
    });
  } catch (error) {
    console.error('[Projects] Error getting summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};