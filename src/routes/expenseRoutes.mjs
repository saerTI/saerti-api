// src/routes/expenseRoutes.mjs
// Rutas unificadas para sistema dinámico de egresos

import express from 'express';
import { trackUsage } from '../middleware/usageMetricsMiddleware.mjs'; // ✅ AGREGAR
import * as ExpenseTypeController from '../controllers/expenseTypeController.mjs';
import * as ExpenseDataController from '../controllers/expenseDataController.mjs';
import * as ExpenseDashboardController from '../controllers/expenseDashboardController.mjs';

const router = express.Router();

// ============================================
// EXPENSE TYPES - Gestión de tipos (NO TRACKEAR - configuración)
// ============================================

// CRUD de tipos
router.get('/expense-types', ExpenseTypeController.getAllExpenseTypes);
router.get('/expense-types/:id', ExpenseTypeController.getExpenseTypeById);
router.get('/expense-types/:id/fields', ExpenseTypeController.getExpenseTypeFields);
router.post('/expense-types', ExpenseTypeController.createExpenseType);
router.put('/expense-types/:id', ExpenseTypeController.updateExpenseType);
router.delete('/expense-types/:id', ExpenseTypeController.deleteExpenseType);

// Categorías por tipo
router.get('/expense-types/:typeId/categories', ExpenseTypeController.getCategoriesByType);
router.post('/expense-types/:typeId/categories', ExpenseTypeController.createCategory);
router.put('/expense-categories/:id', ExpenseTypeController.updateCategory);
router.delete('/expense-categories/:id', ExpenseTypeController.deleteCategory);

// Estados por tipo
router.get('/expense-types/:typeId/statuses', ExpenseTypeController.getStatusesByType);
router.post('/expense-types/:typeId/statuses', ExpenseTypeController.createStatus);
router.put('/expense-statuses/:id', ExpenseTypeController.updateStatus);
router.delete('/expense-statuses/:id', ExpenseTypeController.deleteStatus);

// ============================================
// EXPENSES DATA - Datos de egresos (✅ TRACKEAR AQUÍ)
// ============================================

// GET: No trackear (solo lectura)
router.get('/expenses', ExpenseDataController.getAllExpenses);
router.get('/expenses/stats', ExpenseDataController.getExpenseStats);
router.get('/expenses/:id', ExpenseDataController.getExpenseById);

// ✅ POST BULK: TRACKEAR múltiples transacciones (debe ir ANTES de /expenses para evitar conflicto)
router.post(
  '/expenses/bulk',
  trackUsage('cash-flow', 'transactions', { incrementBy: 'dynamic' }),
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (data.success && data.data?.success?.length > 0) {
        req.actualTransactionsCreated = data.data.success.length;
      }
      return originalJson(data);
    };
    await ExpenseDataController.bulkCreateExpenses(req, res, next);
  }
);

// ✅ POST: TRACKEAR como transacción
router.post(
  '/expenses',
  trackUsage('cash-flow', 'transactions'),
  ExpenseDataController.createExpense
);

// ✅ PUT: TRACKEAR como transacción
router.put(
  '/expenses/:id',
  trackUsage('cash-flow', 'transactions'),
  ExpenseDataController.updateExpense
);

// DELETE: NO trackear (eliminar no cuenta como nueva transacción)
router.delete('/expenses/:id', ExpenseDataController.deleteExpense);

// Estadísticas: NO trackear (solo lectura)
router.get('/expense-types/:typeId/expenses-by-status', ExpenseDataController.getExpensesByStatus);

// ============================================
// DASHBOARD - NO TRACKEAR (solo lectura)
// ============================================
router.get('/expenses/dashboard/summary', ExpenseDashboardController.getExpenseDashboardSummary);
router.get('/expenses/dashboard/by-type', ExpenseDashboardController.getExpensesByType);
router.get('/expenses/dashboard/by-category', ExpenseDashboardController.getExpensesByCategory);
router.get('/expenses/dashboard/cash-flow', ExpenseDashboardController.getExpenseCashFlow);
router.get('/expenses/dashboard/trends', ExpenseDashboardController.getExpenseTrends);
router.get('/expenses/dashboard/category-by-period', ExpenseDashboardController.getExpensesCategoryByPeriod);

export default router;