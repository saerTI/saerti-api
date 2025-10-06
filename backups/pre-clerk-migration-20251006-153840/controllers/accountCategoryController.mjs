// src/controllers/accountCategoryController.mjs
import * as AccountCategoryModel from '../models/accountCategoryModel.mjs';

/**
 * Get all account categories
 */
export async function getAllCategories(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getAllCategories');

    const filters = {
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      type: req.query.type,
      group_name: req.query.group_name,
      search: req.query.search
    };

    const categories = await AccountCategoryModel.getAll(filters);

    res.json({
      success: true,
      data: categories,
      message: 'Categorías de cuentas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.getAllCategories - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías de cuentas',
      error: error.message
    });
  }
}

/**
 * Get active account categories only
 */
export async function getActiveCategories(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getActiveCategories');

    const categories = await AccountCategoryModel.getActive();

    res.json({
      success: true,
      data: categories,
      message: 'Categorías activas obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.getActiveCategories - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías activas',
      error: error.message
    });
  }
}

/**
 * Get account category by ID
 */
export async function getCategoryById(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getCategoryById');

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    const category = await AccountCategoryModel.getById(id);

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
    console.error('❌ AccountCategoryController.getCategoryById - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la categoría',
      error: error.message
    });
  }
}

/**
 * Get account category by code
 */
export async function getCategoryByCode(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getCategoryByCode');

    const { code } = req.params;

    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Código de categoría inválido'
      });
    }

    const category = await AccountCategoryModel.getByCode(code);

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
    console.error('❌ AccountCategoryController.getCategoryByCode - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la categoría',
      error: error.message
    });
  }
}

/**
 * Create new account category
 */
export async function createCategory(req, res) {
  try {
    console.log('🎯 AccountCategoryController.createCategory');

    const { code, name, type = 'gastos_generales', group_name = null, active = true } = req.body;

    // Validation
    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El código de la categoría es requerido'
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }

    if (code.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'El código no puede exceder 20 caracteres'
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede exceder 255 caracteres'
      });
    }

    // Validate type enum
    const validTypes = ['mano_obra', 'maquinaria', 'materiales', 'combustibles', 'gastos_generales'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`
      });
    }

    if (group_name && group_name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del grupo no puede exceder 100 caracteres'
      });
    }

    const categoryData = {
      code: code.trim(),
      name: name.trim(),
      type,
      group_name: group_name ? group_name.trim() : null,
      active: Boolean(active)
    };

    const newCategory = await AccountCategoryModel.create(categoryData);

    res.status(201).json({
      success: true,
      data: newCategory,
      message: 'Categoría creada exitosamente'
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.createCategory - Error:', error);

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
 * Update account category
 */
export async function updateCategory(req, res) {
  try {
    console.log('🎯 AccountCategoryController.updateCategory');

    const { id } = req.params;
    const { code, name, type, group_name, active } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    // Validation
    if (code !== undefined) {
      if (!code || code.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'El código de la categoría no puede estar vacío'
        });
      }

      if (code.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'El código no puede exceder 20 caracteres'
        });
      }
    }

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la categoría no puede estar vacío'
        });
      }

      if (name.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'El nombre no puede exceder 255 caracteres'
        });
      }
    }

    if (type !== undefined) {
      const validTypes = ['mano_obra', 'maquinaria', 'materiales', 'combustibles', 'gastos_generales'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`
        });
      }
    }

    if (group_name !== undefined && group_name && group_name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del grupo no puede exceder 100 caracteres'
      });
    }

    const updateData = {};
    if (code !== undefined) updateData.code = code.trim();
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (group_name !== undefined) updateData.group_name = group_name ? group_name.trim() : null;
    if (active !== undefined) updateData.active = Boolean(active);

    const updatedCategory = await AccountCategoryModel.update(id, updateData);

    res.json({
      success: true,
      data: updatedCategory,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.updateCategory - Error:', error);

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
 * Delete account category
 */
export async function deleteCategory(req, res) {
  try {
    console.log('🎯 AccountCategoryController.deleteCategory');

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    const result = await AccountCategoryModel.deleteCategory(id);

    res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.deleteCategory - Error:', error);

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
 * Get categories grouped by type
 */
export async function getCategoriesGroupedByType(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getCategoriesGroupedByType');

    const groupedCategories = await AccountCategoryModel.getGroupedByType();

    res.json({
      success: true,
      data: groupedCategories,
      message: 'Categorías agrupadas por tipo obtenidas exitosamente'
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.getCategoriesGroupedByType - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías agrupadas',
      error: error.message
    });
  }
}

/**
 * Get categories by type
 */
export async function getCategoriesByType(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getCategoriesByType');

    const { type } = req.params;

    const validTypes = ['mano_obra', 'maquinaria', 'materiales', 'combustibles', 'gastos_generales'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`
      });
    }

    const categories = await AccountCategoryModel.getByType(type);

    res.json({
      success: true,
      data: categories,
      message: `Categorías de tipo '${type}' obtenidas exitosamente`
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.getCategoriesByType - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías por tipo',
      error: error.message
    });
  }
}

/**
 * Get categories by group name
 */
export async function getCategoriesByGroupName(req, res) {
  try {
    console.log('🎯 AccountCategoryController.getCategoriesByGroupName');

    const { groupName } = req.params;

    if (!groupName || groupName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nombre del grupo inválido'
      });
    }

    const categories = await AccountCategoryModel.getByGroupName(groupName);

    res.json({
      success: true,
      data: categories,
      message: `Categorías del grupo '${groupName}' obtenidas exitosamente`
    });
  } catch (error) {
    console.error('❌ AccountCategoryController.getCategoriesByGroupName - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las categorías por grupo',
      error: error.message
    });
  }
}