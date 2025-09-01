// src/routes/incomeCategoriesRoutes.mjs
import express from 'express';
import * as incomeCategoriesController from '../controllers/incomeCategoriesController.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/income-categories - Get all income categories
router.get('/', incomeCategoriesController.getAllCategories);

// GET /api/income-categories/active - Get active income categories only
router.get('/active', incomeCategoriesController.getActiveCategories);

// GET /api/income-categories/usage - Get categories usage statistics
router.get('/usage', incomeCategoriesController.getCategoriesUsage);

// GET /api/income-categories/:id - Get income category by ID
router.get('/:id', incomeCategoriesController.getCategoryById);

// POST /api/income-categories - Create new income category
router.post('/', incomeCategoriesController.createCategory);

// PUT /api/income-categories/:id - Update income category
router.put('/:id', incomeCategoriesController.updateCategory);

// DELETE /api/income-categories/:id - Delete income category
router.delete('/:id', incomeCategoriesController.deleteCategory);

export default router;
