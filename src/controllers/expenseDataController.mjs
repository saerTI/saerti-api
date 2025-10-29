// src/controllers/expenseDataController.mjs
// Controlador para datos de egresos con validación dinámica

import * as ExpenseDataModel from '../models/expenseDataModel.mjs';
import { validateExpenseData } from '../services/expenseValidationService.mjs';

/**
 * GET /api/expenses
 * Obtener egresos con filtros y paginación
 */
export async function getAllExpenses(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const filters = {
      organization_id: organizationId,
      expense_type_id: req.query.expense_type_id,
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

    const [expenses, total] = await Promise.all([
      ExpenseDataModel.getAllExpenses(filters),
      ExpenseDataModel.countExpenses(filters)
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: (filters.offset + filters.limit) < total
      }
    });
  } catch (error) {
    console.error('Error getting expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener egresos',
      error: error.message
    });
  }
}

/**
 * GET /api/expenses/:id
 * Obtener un egreso por ID
 */
export async function getExpenseById(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const expense = await ExpenseDataModel.getExpenseById(id, organizationId);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Egreso no encontrado'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    console.error('Error getting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener egreso',
      error: error.message
    });
  }
}

/**
 * POST /api/expenses
 * Crear un nuevo egreso con validación dinámica
 */
export async function createExpense(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Validar datos según configuración del tipo
    const validation = await validateExpenseData(req.body, req.body.expense_type_id, organizationId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const expenseData = {
      ...req.body,
      organization_id: organizationId,
      created_by: userId
    };

    const newId = await ExpenseDataModel.createExpense(expenseData);

    res.status(201).json({
      success: true,
      message: 'Egreso creado exitosamente',
      data: { id: newId },
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear egreso',
      error: error.message
    });
  }
}

/**
 * PUT /api/expenses/:id
 * Actualizar un egreso con validación dinámica
 */
export async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;

    // Verificar que existe
    const existingExpense = await ExpenseDataModel.getExpenseById(id, organizationId);
    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: 'Egreso no encontrado'
      });
    }

    // Validar datos según configuración del tipo
    const expenseTypeId = req.body.expense_type_id || existingExpense.expense_type_id;
    const validation = await validateExpenseData(req.body, expenseTypeId, organizationId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    const expenseData = {
      ...req.body,
      updated_by: userId
    };

    const affectedRows = await ExpenseDataModel.updateExpense(id, organizationId, expenseData);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudo actualizar el egreso'
      });
    }

    res.json({
      success: true,
      message: 'Egreso actualizado exitosamente',
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar egreso',
      error: error.message
    });
  }
}

/**
 * DELETE /api/expenses/:id
 * Eliminar un egreso
 */
export async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const affectedRows = await ExpenseDataModel.deleteExpense(id, organizationId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Egreso no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Egreso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar egreso',
      error: error.message
    });
  }
}

/**
 * GET /api/expenses/stats
 * Obtener estadísticas de egresos
 */
export async function getExpenseStats(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.query.organization_id;
    const expenseTypeId = req.query.expense_type_id;
    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;

    const stats = await ExpenseDataModel.getExpenseStats(organizationId, expenseTypeId, dateFrom, dateTo);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting expense stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
}

/**
 * GET /api/expense-types/:typeId/expenses-by-status
 * Obtener egresos agrupados por estado
 */
export async function getExpensesByStatus(req, res) {
  try {
    const { typeId } = req.params;
    const organizationId = req.user?.organization_id || req.query.organization_id;

    const groupedExpenses = await ExpenseDataModel.getExpensesByStatus(organizationId, typeId);

    res.json({
      success: true,
      data: groupedExpenses
    });
  } catch (error) {
    console.error('Error getting expenses by status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener egresos por estado',
      error: error.message
    });
  }
}

/**
 * POST /api/expenses/bulk
 * Crear múltiples egresos en una sola transacción
 */
export async function bulkCreateExpenses(req, res) {
  try {
    const organizationId = req.user?.organization_id || req.body.organization_id;
    const userId = req.user?.id;
    const { expenses } = req.body;

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de egresos para crear'
      });
    }

    const results = {
      success: [],
      errors: [],
      total: expenses.length
    };

    // Validar y preparar todos los egresos
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];

      try {
        // Validar datos según configuración del tipo
        const validation = await validateExpenseData(expense, expense.expense_type_id, organizationId);

        if (!validation.valid) {
          results.errors.push({
            index: i,
            row: i + 2, // +2 porque Excel empieza en 1 y la primera fila es el header
            data: expense,
            errors: validation.errors
          });
          continue;
        }

        const expenseData = {
          ...expense,
          organization_id: organizationId,
          created_by: userId
        };

        const newId = await ExpenseDataModel.createExpense(expenseData);

        results.success.push({
          index: i,
          row: i + 2,
          id: newId,
          data: expense
        });
      } catch (error) {
        results.errors.push({
          index: i,
          row: i + 2,
          data: expense,
          errors: [{ message: error.message }]
        });
      }
    }

    const statusCode = results.errors.length === 0 ? 201 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      success: results.errors.length === 0,
      message: results.errors.length === 0
        ? `Se crearon ${results.success.length} egresos exitosamente`
        : `Se crearon ${results.success.length} egresos. ${results.errors.length} fallaron.`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk create expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear egresos masivamente',
      error: error.message
    });
  }
}
