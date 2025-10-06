// src/routes/accountCategoryRoutes.mjs
import express from 'express';
import * as accountCategoryController from '../controllers/accountCategoryController.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/account-categories - Get all account categories
router.get('/', accountCategoryController.getAllCategories);

// GET /api/account-categories/active - Get active account categories only
router.get('/active', accountCategoryController.getActiveCategories);

// GET /api/account-categories/grouped-by-type - Get categories grouped by type
router.get('/grouped-by-type', accountCategoryController.getCategoriesGroupedByType);

// GET /api/account-categories/type/:type - Get categories by type
router.get('/type/:type', accountCategoryController.getCategoriesByType);

// GET /api/account-categories/group/:groupName - Get categories by group name
router.get('/group/:groupName', accountCategoryController.getCategoriesByGroupName);

// GET /api/account-categories/code/:code - Get account category by code
router.get('/code/:code', accountCategoryController.getCategoryByCode);

// GET /api/account-categories/:id - Get account category by ID
router.get('/:id', accountCategoryController.getCategoryById);

// POST /api/account-categories - Create new account category
router.post('/', accountCategoryController.createCategory);

// PUT /api/account-categories/:id - Update account category
router.put('/:id', accountCategoryController.updateCategory);

// DELETE /api/account-categories/:id - Delete account category
router.delete('/:id', accountCategoryController.deleteCategory);

export default router;