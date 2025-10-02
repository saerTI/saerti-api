// src/controllers/factoringEntityController.mjs
import FactoringEntityModel from '../models/factoringEntityModel.mjs';

/**
 * Obtiene todas las entidades de factoring
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getAllFactoringEntities = async (req, res) => {
  try {
    const entities = await FactoringEntityModel.getAll();

    res.status(200).json({
      success: true,
      data: entities
    });
  } catch (error) {
    console.error('Error in getAllFactoringEntities:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Crea una nueva entidad de factoring
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createFactoringEntity = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la entidad es requerido'
      });
    }

    // Verificar si ya existe una entidad con ese nombre
    const existingEntity = await FactoringEntityModel.getByName(name);
    if (existingEntity) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una entidad de factoring con ese nombre'
      });
    }

    const newEntity = await FactoringEntityModel.create({ name });

    res.status(201).json({
      success: true,
      message: 'Entidad de factoring creada exitosamente',
      data: newEntity
    });
  } catch (error) {
    console.error('Error in createFactoringEntity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};