// src/controllers/factoringEntityController.mjs
import { pool } from '../config/database.mjs';

/**
 * GET /api/factoring-entities
 * Obtener todas las entidades de factoring (filtrado por organización)
 */
export const getAllFactoringEntities = async (req, res) => {
  try {
    // 🏢 Multi-tenancy: Filtrar por organización
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización para el usuario'
      });
    }

    const [entities] = await pool.query(
      'SELECT * FROM factoring_entities WHERE organization_id = ? ORDER BY created_at DESC',
      [organizationId]
    );
    
    res.json({ 
      success: true, 
      data: entities,
      count: entities.length,
      organization_id: organizationId
    });
  } catch (error) {
    console.error('[Factoring Entities] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener entidades de factoring',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/factoring-entities
 * Crear nueva entidad de factoring
 */
export const createFactoringEntity = async (req, res) => {
  try {
    const { name } = req.body;
    const organizationId = req.user.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró organización para el usuario'
      });
    }

    const [result] = await pool.query(
      'INSERT INTO factoring_entities (organization_id, name, created_at) VALUES (?, ?, NOW())',
      [organizationId, name]
    );
    
    res.status(201).json({ 
      success: true, 
      data: {
        id: result.insertId,
        organization_id: organizationId,
        name
      },
      message: 'Entidad de factoring creada exitosamente'
    });
  } catch (error) {
    console.error('[Factoring Entities] Error creating:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear entidad de factoring',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};