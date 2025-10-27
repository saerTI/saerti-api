// src/controllers/incomeTypeController.mjs
// Controlador para tipos de ingresos, categorías y estados

import * as IncomeTypeModel from '../models/incomeTypeModel.mjs';
import * as IncomeCategoryModel from '../models/incomeCategoryModel.mjs';
import * as IncomeStatusModel from '../models/incomeStatusModel.mjs';
import { getVisibleFields } from '../services/incomeValidationService.mjs';

// ============================================
// INCOME TYPES - Tipos de Ingresos
// ============================================

/**
 * GET /api/income-types
 * Obtener todos los tipos de ingresos de la organización
 */
export async function getAllIncomeTypes(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const incomeTypes = await IncomeTypeModel.getAllIncomeTypes(organizationId, onlyActive);

    res.json({
      success: true,
      data: incomeTypes,
      count: incomeTypes.length
    });
  } catch (error) {
    console.error('Error getting income types:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de ingresos',
      error: error.message
    });
  }
}

/**
 * GET /api/income-types/:id
 * Obtener un tipo de ingreso por ID
 */
export async function getIncomeTypeById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const incomeType = await IncomeTypeModel.getIncomeTypeById(id, organizationId);

    if (!incomeType) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: incomeType
    });
  } catch (error) {
    console.error('Error getting income type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipo de ingreso',
      error: error.message
    });
  }
}

/**
 * GET /api/income-types/:id/fields
 * Obtener campos visibles y requeridos para un tipo
 */
export async function getIncomeTypeFields(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const fields = await getVisibleFields(id, organizationId);

    if (!fields) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('Error getting income type fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener campos del tipo',
      error: error.message
    });
  }
}

/**
 * POST /api/income-types
 * Crear un nuevo tipo de ingreso
 */
export async function createIncomeType(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que el usuario tenga una organización
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'El usuario debe pertenecer a una organización para crear tipos de ingreso'
      });
    }

    // Verificar nombre duplicado
    const nameExists = await IncomeTypeModel.incomeTypeNameExists(req.body.name, organizationId);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un tipo de ingreso con ese nombre'
      });
    }

    const incomeTypeData = {
      ...req.body,
      organization_id: organizationId,
      created_by: userId
    };

    const newId = await IncomeTypeModel.createIncomeType(incomeTypeData);

    res.status(201).json({
      success: true,
      message: 'Tipo de ingreso creado exitosamente',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Error creating income type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear tipo de ingreso',
      error: error.message
    });
  }
}

/**
 * PUT /api/income-types/:id
 * Actualizar un tipo de ingreso
 */
export async function updateIncomeType(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que existe
    const existingType = await IncomeTypeModel.getIncomeTypeById(id, organizationId);
    if (!existingType) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de ingreso no encontrado'
      });
    }

    // Verificar nombre duplicado (excluyendo el actual)
    if (req.body.name) {
      const nameExists = await IncomeTypeModel.incomeTypeNameExists(req.body.name, organizationId, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro tipo de ingreso con ese nombre'
        });
      }
    }

    const incomeTypeData = {
      ...req.body,
      updated_by: userId
    };

    const affectedRows = await IncomeTypeModel.updateIncomeType(id, organizationId, incomeTypeData);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el tipo de ingreso'
      });
    }

    res.json({
      success: true,
      message: 'Tipo de ingreso actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error updating income type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tipo de ingreso',
      error: error.message
    });
  }
}

/**
 * DELETE /api/income-types/:id
 * Eliminar (soft delete) un tipo de ingreso
 */
export async function deleteIncomeType(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    // Verificar si tiene ingresos asociados
    const incomesCount = await IncomeTypeModel.countIncomesForType(id);
    if (incomesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el tipo porque tiene ${incomesCount} ingreso(s) asociado(s)`
      });
    }

    const affectedRows = await IncomeTypeModel.deleteIncomeType(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tipo de ingreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting income type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar tipo de ingreso',
      error: error.message
    });
  }
}

// ============================================
// CATEGORIES - Categorías por tipo
// ============================================

/**
 * GET /api/income-types/:typeId/categories
 * Obtener categorías de un tipo de ingreso
 */
export async function getCategoriesByType(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const categories = await IncomeCategoryModel.getCategoriesByType(typeId, organizationId, onlyActive);

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
 * POST /api/income-types/:typeId/categories
 * Crear una nueva categoría
 */
export async function createCategory(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    // Verificar nombre duplicado en el tipo
    const nameExists = await IncomeCategoryModel.categoryNameExistsInType(typeId, req.body.name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre en este tipo'
      });
    }

    const categoryData = {
      ...req.body,
      income_type_id: typeId,
      organization_id: organizationId
    };

    const newId = await IncomeCategoryModel.createCategory(categoryData);

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
 * PUT /api/income-categories/:id
 * Actualizar una categoría
 */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    const category = await IncomeCategoryModel.getCategoryById(id, organizationId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Verificar nombre duplicado en el tipo (excluyendo la actual)
    if (req.body.name) {
      const nameExists = await IncomeCategoryModel.categoryNameExistsInType(category.income_type_id, req.body.name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otra categoría con ese nombre en este tipo'
        });
      }
    }

    const affectedRows = await IncomeCategoryModel.updateCategory(id, organizationId, req.body);

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
 * DELETE /api/income-categories/:id
 * Eliminar una categoría
 */
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const affectedRows = await IncomeCategoryModel.deleteCategory(id, organizationId);

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
 * GET /api/income-types/:typeId/statuses
 * Obtener estados de un tipo de ingreso
 */
export async function getStatusesByType(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const onlyActive = req.query.only_active !== 'false';

    const statuses = await IncomeStatusModel.getStatusesByType(typeId, organizationId, onlyActive);

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
 * POST /api/income-types/:typeId/statuses
 * Crear un nuevo estado
 */
export async function createStatus(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    // Verificar nombre duplicado en el tipo
    const nameExists = await IncomeStatusModel.statusNameExistsInType(typeId, req.body.name);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un estado con ese nombre en este tipo'
      });
    }

    const statusData = {
      ...req.body,
      income_type_id: typeId,
      organization_id: organizationId
    };

    const newId = await IncomeStatusModel.createStatus(statusData);

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
 * PUT /api/income-statuses/:id
 * Actualizar un estado
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;

    const status = await IncomeStatusModel.getStatusById(id, organizationId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Estado no encontrado'
      });
    }

    // Verificar nombre duplicado en el tipo (excluyendo el actual)
    if (req.body.name) {
      const nameExists = await IncomeStatusModel.statusNameExistsInType(status.income_type_id, req.body.name, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro estado con ese nombre en este tipo'
        });
      }
    }

    const affectedRows = await IncomeStatusModel.updateStatus(id, organizationId, req.body);

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
 * DELETE /api/income-statuses/:id
 * Eliminar un estado
 */
export async function deleteStatus(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    // Verificar si tiene ingresos asociados
    const incomesCount = await IncomeStatusModel.countIncomesForStatus(id);
    if (incomesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el estado porque tiene ${incomesCount} ingreso(s) asociado(s)`
      });
    }

    const affectedRows = await IncomeStatusModel.deleteStatus(id, organizationId);

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
