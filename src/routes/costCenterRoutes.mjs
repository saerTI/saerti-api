// src/routes/costCenterRoutes.mjs
import express from 'express';
import * as costCenterController from '../controllers/costCenterController.mjs';

const router = express.Router();

// Authentication is handled globally by clerkAuth in app.mjs

// GET /api/cost-centers - Get all cost centers
router.get('/', costCenterController.getAllCostCenters);

// GET /api/cost-centers/:id - Get cost center by ID
router.get('/:id', costCenterController.getCostCenterById);

// POST /api/cost-centers - Create new cost center
router.post('/', costCenterController.createCostCenter);

// PUT /api/cost-centers/:id - Update cost center
router.put('/:id', costCenterController.updateCostCenter);

// DELETE /api/cost-centers/:id - Delete cost center
router.delete('/:id', costCenterController.deleteCostCenter);

export default router;
