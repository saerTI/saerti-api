// src/routes/incomeRoutes.mjs
// Rutas unificadas para sistema dinámico de ingresos

import express from 'express';
import * as IncomeTypeController from '../controllers/incomeTypeController.mjs';
import * as IncomeDataController from '../controllers/incomeDataController.mjs';
import * as IncomeDashboardController from '../controllers/incomeDashboardController.mjs';

const router = express.Router();

// ============================================
// INCOME TYPES - Gestión de tipos
// ============================================

// CRUD de tipos
router.get('/income-types', IncomeTypeController.getAllIncomeTypes);
router.get('/income-types/:id', IncomeTypeController.getIncomeTypeById);
router.get('/income-types/:id/fields', IncomeTypeController.getIncomeTypeFields);
router.post('/income-types', IncomeTypeController.createIncomeType);
router.put('/income-types/:id', IncomeTypeController.updateIncomeType);
router.delete('/income-types/:id', IncomeTypeController.deleteIncomeType);

// Categorías por tipo
router.get('/income-types/:typeId/categories', IncomeTypeController.getCategoriesByType);
router.post('/income-types/:typeId/categories', IncomeTypeController.createCategory);
router.put('/income-categories/:id', IncomeTypeController.updateCategory);
router.delete('/income-categories/:id', IncomeTypeController.deleteCategory);

// Estados por tipo
router.get('/income-types/:typeId/statuses', IncomeTypeController.getStatusesByType);
router.post('/income-types/:typeId/statuses', IncomeTypeController.createStatus);
router.put('/income-statuses/:id', IncomeTypeController.updateStatus);
router.delete('/income-statuses/:id', IncomeTypeController.deleteStatus);

// ============================================
// INCOMES DATA - Datos de ingresos
// ============================================

// CRUD de ingresos
router.get('/incomes', IncomeDataController.getAllIncomes);
router.get('/incomes/stats', IncomeDataController.getIncomeStats);
router.get('/incomes/:id', IncomeDataController.getIncomeById);
router.post('/incomes', IncomeDataController.createIncome);
router.put('/incomes/:id', IncomeDataController.updateIncome);
router.delete('/incomes/:id', IncomeDataController.deleteIncome);

// Estadísticas y agrupaciones
router.get('/income-types/:typeId/incomes-by-status', IncomeDataController.getIncomesByStatus);

// ============================================
// DASHBOARD - Endpoints para resumen y análisis
// ============================================
router.get('/incomes/dashboard/summary', IncomeDashboardController.getIncomeDashboardSummary);
router.get('/incomes/dashboard/by-type', IncomeDashboardController.getIncomesByType);
router.get('/incomes/dashboard/by-category', IncomeDashboardController.getIncomesByCategory);
router.get('/incomes/dashboard/cash-flow', IncomeDashboardController.getIncomeCashFlow);
router.get('/incomes/dashboard/trends', IncomeDashboardController.getIncomeTrends);
router.get('/incomes/dashboard/category-by-period', IncomeDashboardController.getIncomesCategoryByPeriod);

export default router;
