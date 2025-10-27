// src/controllers/incomeDataController.mjs
// Controlador para datos de ingresos con validación dinámica

import * as IncomeDataModel from '../models/incomeDataModel.mjs';
import { validateIncomeData } from '../services/incomeValidationService.mjs';

/**
 * GET /api/incomes
 * Obtener ingresos con filtros y paginación
 */
export async function getAllIncomes(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const filters = {
      organization_id: organizationId,
      income_type_id: req.query.income_type_id,
      status_id: req.query.status_id,
      category_id: req.query.category_id,
      cost_center_id: req.query.cost_center_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      payment_status: req.query.payment_status,
      search: req.query.search,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const [incomes, total] = await Promise.all([
      IncomeDataModel.getAllIncomes(filters),
      IncomeDataModel.countIncomes(filters)
    ]);

    res.json({
      success: true,
      data: incomes,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: (filters.offset + filters.limit) < total
      }
    });
  } catch (error) {
    console.error('Error getting incomes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ingresos',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/:id
 * Obtener un ingreso por ID
 */
export async function getIncomeById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const income = await IncomeDataModel.getIncomeById(id, organizationId);

    if (!income) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: income
    });
  } catch (error) {
    console.error('Error getting income:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ingreso',
      error: error.message
    });
  }
}

/**
 * POST /api/incomes
 * Crear un nuevo ingreso con validación dinámica
 */
export async function createIncome(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Validar datos según configuración del tipo
    const validation = await validateIncomeData(req.body, req.body.income_type_id, organizationId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const incomeData = {
      ...req.body,
      organization_id: organizationId,
      created_by: userId
    };

    const newId = await IncomeDataModel.createIncome(incomeData);

    res.status(201).json({
      success: true,
      message: 'Ingreso creado exitosamente',
      data: { id: newId },
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    });
  } catch (error) {
    console.error('Error creating income:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear ingreso',
      error: error.message
    });
  }
}

/**
 * PUT /api/incomes/:id
 * Actualizar un ingreso con validación dinámica
 */
export async function updateIncome(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que existe
    const existingIncome = await IncomeDataModel.getIncomeById(id, organizationId);
    if (!existingIncome) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    // Validar datos según configuración del tipo
    const incomeTypeId = req.body.income_type_id || existingIncome.income_type_id;
    const validation = await validateIncomeData(req.body, incomeTypeId, organizationId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const incomeData = {
      ...req.body,
      updated_by: userId
    };

    const affectedRows = await IncomeDataModel.updateIncome(id, organizationId, incomeData);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el ingreso'
      });
    }

    res.json({
      success: true,
      message: 'Ingreso actualizado exitosamente',
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    });
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ingreso',
      error: error.message
    });
  }
}

/**
 * DELETE /api/incomes/:id
 * Eliminar un ingreso
 */
export async function deleteIncome(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const affectedRows = await IncomeDataModel.deleteIncome(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingreso no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Ingreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar ingreso',
      error: error.message
    });
  }
}

/**
 * GET /api/incomes/stats
 * Obtener estadísticas de ingresos
 */
export async function getIncomeStats(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const incomeTypeId = req.query.income_type_id;
    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;

    const stats = await IncomeDataModel.getIncomeStats(organizationId, incomeTypeId, dateFrom, dateTo);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting income stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
}

/**
 * GET /api/income-types/:typeId/incomes-by-status
 * Obtener ingresos agrupados por estado
 */
export async function getIncomesByStatus(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const groupedIncomes = await IncomeDataModel.getIncomesByStatus(organizationId, typeId);

    res.json({
      success: true,
      data: groupedIncomes
    });
  } catch (error) {
    console.error('Error getting incomes by status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ingresos por estado',
      error: error.message
    });
  }
}
