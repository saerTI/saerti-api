// src/controllers/incomeCategoriesController.mjs
import * as IncomeCategoriesModel from '../models/incomeCategoriesModel.mjs';

/**
 * Get all income categories
 */
export async function getAllCategories(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.getAllCategories');
    
    const filters = {
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      search: req.query.search
    };
    
    const categories = await IncomeCategoriesModel.getAll(filters);
    
    res.json({
      success: true,
      data: categories,
      message: 'Categorías de ingresos obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.getAllCategories - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías de ingresos',
      error: error.message
    });
  }
}

/**
 * Get active income categories only
 */
export async function getActiveCategories(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.getActiveCategories');
    
    const categories = await IncomeCategoriesModel.getActive();
    
    res.json({
      success: true,
      data: categories,
      message: 'Categorías activas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.getActiveCategories - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías activas',
      error: error.message
    });
  }
}

/**
 * Get income category by ID
 */
export async function getCategoryById(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.getCategoryById');
    
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }
    
    const category = await IncomeCategoriesModel.getById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: category,
      message: 'Categoría obtenida exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.getCategoryById - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la categoría',
      error: error.message
    });
  }
}

/**
 * Create new income category
 */
export async function createCategory(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.createCategory');
    
    const { categoria, active = true } = req.body;
    
    // Validation
    if (!categoria || categoria.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }
    
    if (categoria.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría no puede exceder 100 caracteres'
      });
    }
    
    const categoryData = {
      categoria: categoria.trim(),
      active: Boolean(active)
    };
    
    const newCategory = await IncomeCategoriesModel.create(categoryData);
    
    res.status(201).json({
      success: true,
      data: newCategory,
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.createCategory - Error:', error);
    
    if (error.message.includes('Ya existe una categoría')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al crear la categoría',
      error: error.message
    });
  }
}

/**
 * Update income category
 */
export async function updateCategory(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.updateCategory');
    
    const { id } = req.params;
    const { categoria, active } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }
    
    // Validation
    if (categoria !== undefined) {
      if (!categoria || categoria.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la categoría no puede estar vacío'
        });
      }
      
      if (categoria.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la categoría no puede exceder 100 caracteres'
        });
      }
    }
    
    const updateData = {};
    if (categoria !== undefined) updateData.categoria = categoria.trim();
    if (active !== undefined) updateData.active = Boolean(active);
    
    const updatedCategory = await IncomeCategoriesModel.update(id, updateData);
    
    res.json({
      success: true,
      data: updatedCategory,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.updateCategory - Error:', error);
    
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Ya existe una categoría')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la categoría',
      error: error.message
    });
  }
}

/**
 * Delete income category
 */
export async function deleteCategory(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.deleteCategory');
    
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }
    
    const result = await IncomeCategoriesModel.deleteCategory(id);
    
    res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.deleteCategory - Error:', error);
    
    if (error.message.includes('no encontrada')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la categoría',
      error: error.message
    });
  }
}

/**
 * Get categories usage statistics
 */
export async function getCategoriesUsage(req, res) {
  try {
    console.log('🎯 IncomeCategoriesController.getCategoriesUsage');
    
    const usage = await IncomeCategoriesModel.getCategoriesUsage();
    
    res.json({
      success: true,
      data: usage,
      message: 'Estadísticas de uso de categorías obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ IncomeCategoriesController.getCategoriesUsage - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas de uso',
      error: error.message
    });
  }
}
