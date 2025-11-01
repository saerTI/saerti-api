// src/routes/incomeRoutes.mjs
import express from 'express';
import { trackUsage } from '../middleware/usageMetricsMiddleware.mjs'; // ✅ SOLO AGREGAR ESTO
import * as IncomeTypeController from '../controllers/incomeTypeController.mjs';
import * as IncomeDataController from '../controllers/incomeDataController.mjs';
import * as IncomeDashboardController from '../controllers/incomeDashboardController.mjs';

const router = express.Router();

// ============================================
// INCOME TYPES - Gestión de tipos (NO TRACKEAR - configuración)
// ============================================
router.get('/income-types', IncomeTypeController.getAllIncomeTypes);
router.get('/income-types/:id', IncomeTypeController.getIncomeTypeById);
router.get('/income-types/:id/fields', IncomeTypeController.getIncomeTypeFields);
router.post('/income-types', IncomeTypeController.createIncomeType);
router.put('/income-types/:id', IncomeTypeController.updateIncomeType);
router.delete('/income-types/:id', IncomeTypeController.deleteIncomeType);

// Categorías por tipo (NO TRACKEAR - configuración)
router.get('/income-types/:typeId/categories', IncomeTypeController.getCategoriesByType);
router.post('/income-types/:typeId/categories', IncomeTypeController.createCategory);
router.put('/income-categories/:id', IncomeTypeController.updateCategory);
router.delete('/income-categories/:id', IncomeTypeController.deleteCategory);

// Estados por tipo (NO TRACKEAR - configuración)
router.get('/income-types/:typeId/statuses', IncomeTypeController.getStatusesByType);
router.post('/income-types/:typeId/statuses', IncomeTypeController.createStatus);
router.put('/income-statuses/:id', IncomeTypeController.updateStatus);
router.delete('/income-statuses/:id', IncomeTypeController.deleteStatus);

// ============================================
// INCOMES DATA - Datos de ingresos (✅ TRACKEAR AQUÍ)
// ============================================

// GET: No trackear (solo lectura)
router.get('/incomes', IncomeDataController.getAllIncomes);
router.get('/incomes/stats', IncomeDataController.getIncomeStats);
router.get('/incomes/:id', IncomeDataController.getIncomeById);

// ✅ POST: TRACKEAR como transacción
router.post(
  '/incomes',
  trackUsage('cash-flow', 'transactions'),
  IncomeDataController.createIncome
);

// ✅ POST BULK: TRACKEAR múltiples transacciones
router.post(
  '/incomes/bulk',
  trackUsage('cash-flow', 'transactions', { incrementBy: 'dynamic' }),
  async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (data.success && data.data?.success?.length > 0) {
        req.actualTransactionsCreated = data.data.success.length;
      }
      return originalJson(data);
    };
    await IncomeDataController.bulkCreateIncomes(req, res, next);
  }
);

// ✅ PUT: TRACKEAR como transacción
router.put(
  '/incomes/:id',
  trackUsage('cash-flow', 'transactions'),
  IncomeDataController.updateIncome
);

// DELETE: NO trackear (eliminar no cuenta como nueva transacción)
router.delete('/incomes/:id', IncomeDataController.deleteIncome);

// Estadísticas: NO trackear (solo lectura)
router.get('/income-types/:typeId/incomes-by-status', IncomeDataController.getIncomesByStatus);

// ============================================
// DASHBOARD - NO TRACKEAR (solo lectura)
// ============================================
router.get('/incomes/dashboard/summary', IncomeDashboardController.getIncomeDashboardSummary);
router.get('/incomes/dashboard/by-type', IncomeDashboardController.getIncomesByType);
router.get('/incomes/dashboard/by-category', IncomeDashboardController.getIncomesByCategory);
router.get('/incomes/dashboard/cash-flow', IncomeDashboardController.getIncomeCashFlow);
router.get('/incomes/dashboard/trends', IncomeDashboardController.getIncomeTrends);
router.get('/incomes/dashboard/category-by-period', IncomeDashboardController.getIncomesCategoryByPeriod);

export default router;