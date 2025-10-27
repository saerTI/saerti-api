// src/controllers/expenseTypeController.mjs
// Controlador para tipos de egresos, categorías y estados

import * as ExpenseTypeModel from '../models/expenseTypeModel.mjs';
import * as ExpenseCategoryModel from '../models/expenseCategoryModel.mjs';
import * as ExpenseStatusModel from '../models/expenseStatusModel.mjs';
import { getVisibleFields } from '../services/expenseValidationService.mjs';

// ============================================
// EXPENSE TYPES - Tipos de Egresos
// ============================================

/**
 * GET /api/expense-types
 * Obtener todos los tipos de egresos de la organización
 */
export async function getAllExpenseTypes(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const expenseTypes = await ExpenseTypeModel.getAllExpenseTypes(organizationId, onlyActive);

    res.json({
      success: true,
      data: expenseTypes,
      count: expenseTypes.length
    });
  } catch (error) {
    console.error('Error getting expense types:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de egresos',
      error: error.message
    });
  }
}

/**
 * GET /api/expense-types/:id
 * Obtener un tipo de egreso por ID
 */
export async function getExpenseTypeById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const expenseType = await ExpenseTypeModel.getExpenseTypeById(id, organizationId);

    if (!expenseType) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de egreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: expenseType
    });
  } catch (error) {
    console.error('Error getting expense type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipo de egreso',
      error: error.message
    });
  }
}

/**
 * GET /api/expense-types/:id/fields
 * Obtener campos visibles y requeridos para un tipo
 */
export async function getExpenseTypeFields(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const fields = await getVisibleFields(id, organizationId);

    if (!fields) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de egreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('Error getting expense type fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener campos del tipo',
      error: error.message
    });
  }
}

/**
 * POST /api/expense-types
 * Crear un nuevo tipo de egreso
 */
export async function createExpenseType(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que el usuario tenga una organización
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'El usuario debe pertenecer a una organización para crear tipos de egreso'
      });
    }

    // Verificar nombre duplicado
    const nameExists = await ExpenseTypeModel.expenseTypeNameExists(req.body.name, organizationId);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un tipo de egreso con ese nombre'
      });
    }

    const expenseTypeData = {
      ...req.body,
      organization_id: organizationId,
      created_by: userId
    };

    const newId = await ExpenseTypeModel.createExpenseType(expenseTypeData);

    res.status(201).json({
      success: true,
      message: 'Tipo de egreso creado exitosamente',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Error creating expense type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear tipo de egreso',
      error: error.message
    });
  }
}

/**
 * PUT /api/expense-types/:id
 * Actualizar un tipo de egreso
 */
export async function updateExpenseType(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que existe
    const existingType = await ExpenseTypeModel.getExpenseTypeById(id, organizationId);
    if (!existingType) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de egreso no encontrado'
      });
    }

    // Verificar nombre duplicado (excluyendo el actual)
    if (req.body.name) {
      const nameExists = await ExpenseTypeModel.expenseTypeNameExists(req.body.name, organizationId, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro tipo de egreso con ese nombre'
        });
      }
    }

    const expenseTypeData = {
      ...req.body,
      updated_by: userId
    };

    const affectedRows = await ExpenseTypeModel.updateExpenseType(id, organizationId, expenseTypeData);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el tipo de egreso'
      });
    }

    res.json({
      success: true,
      message: 'Tipo de egreso actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error updating expense type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tipo de egreso',
      error: error.message
    });
  }
}

/**
 * DELETE /api/expense-types/:id
 * Eliminar (soft delete) un tipo de egreso
 */
export async function deleteExpenseType(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    // Verificar si tiene egresos asociados
    const expensesCount = await ExpenseTypeModel.countExpensesForType(id);
    if (expensesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el tipo porque tiene ${expensesCount} egreso(s) asociado(s)`
      });
    }

    const affectedRows = await ExpenseTypeModel.deleteExpenseType(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de egreso no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tipo de egreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting expense type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar tipo de egreso',
      error: error.message
    });
  }
}

// ============================================
// CATEGORIES - Categorías por tipo
// ============================================

/**
 * GET /api/expense-types/:typeId/categories
 * Obtener categorías de un tipo de egreso
 */
export async function getCategoriesByType(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const categories = await ExpenseCategoryModel.getCategoriesByType(typeId, organizationId, onlyActive);

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      error: error.message
    });
  }
}

/**
 * POST /api/expense-types/:typeId/categories
 * Crear una nueva categoría
 */
export async function createCategory(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    // Verificar nombre duplicado en el tipo
    const nameExists = await ExpenseCategoryModel.categoryNameExistsInType(typeId, req.body.name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre en este tipo'
      });
    }

    const categoryData = {
      ...req.body,
      expense_type_id: typeId,
      organization_id: organizationId
    };

    const newId = await ExpenseCategoryModel.createCategory(categoryData);

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear categoría',
      error: error.message
    });
  }
}

/**
 * PUT /api/expense-categories/:id
 * Actualizar una categoría
 */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    const category = await ExpenseCategoryModel.getCategoryById(id, organizationId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Verificar nombre duplicado en el tipo (excluyendo la actual)
    if (req.body.name) {
      const nameExists = await ExpenseCategoryModel.categoryNameExistsInType(category.expense_type_id, req.body.name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otra categoría con ese nombre en este tipo'
        });
      }
    }

    const affectedRows = await ExpenseCategoryModel.updateCategory(id, organizationId, req.body);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar la categoría'
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoría',
      error: error.message
    });
  }
}

/**
 * DELETE /api/expense-categories/:id
 * Eliminar una categoría
 */
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const affectedRows = await ExpenseCategoryModel.deleteCategory(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar categoría',
      error: error.message
    });
  }
}

// ============================================
// STATUSES - Estados por tipo
// ============================================

/**
 * GET /api/expense-types/:typeId/statuses
 * Obtener estados de un tipo de egreso
 */
export async function getStatusesByType(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const statuses = await ExpenseStatusModel.getStatusesByType(typeId, organizationId, onlyActive);

    res.json({
      success: true,
      data: statuses,
      count: statuses.length
    });
  } catch (error) {
    console.error('Error getting statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estados',
      error: error.message
    });
  }
}

/**
 * POST /api/expense-types/:typeId/statuses
 * Crear un nuevo estado
 */
export async function createStatus(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    // Verificar nombre duplicado en el tipo
    const nameExists = await ExpenseStatusModel.statusNameExistsInType(typeId, req.body.name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un estado con ese nombre en este tipo'
      });
    }

    const statusData = {
      ...req.body,
      expense_type_id: typeId,
      organization_id: organizationId
    };

    const newId = await ExpenseStatusModel.createStatus(statusData);

    res.status(201).json({
      success: true,
      message: 'Estado creado exitosamente',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Error creating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear estado',
      error: error.message
    });
  }
}

/**
 * PUT /api/expense-statuses/:id
 * Actualizar un estado
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    const status = await ExpenseStatusModel.getStatusById(id, organizationId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Estado no encontrado'
      });
    }

    // Verificar nombre duplicado en el tipo (excluyendo el actual)
    if (req.body.name) {
      const nameExists = await ExpenseStatusModel.statusNameExistsInType(status.expense_type_id, req.body.name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro estado con ese nombre en este tipo'
        });
      }
    }

    const affectedRows = await ExpenseStatusModel.updateStatus(id, organizationId, req.body);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el estado'
      });
    }

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado',
      error: error.message
    });
  }
}

/**
 * DELETE /api/expense-statuses/:id
 * Eliminar un estado
 */
export async function deleteStatus(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    // Verificar si tiene egresos asociados
    const expensesCount = await ExpenseStatusModel.countExpensesForStatus(id);
    if (expensesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el estado porque tiene ${expensesCount} egreso(s) asociado(s)`
      });
    }

    const affectedRows = await ExpenseStatusModel.deleteStatus(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estado no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Estado eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar estado',
      error: error.message
    });
  }
}
