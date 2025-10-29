// src/routes/organizationRoutes.mjs
import { Router } from 'express';
import {
  getCurrentOrganization,
  getUserOrganizations,
  switchOrganization
} from '../controllers/organizationController.mjs';

const router = Router();

// Todas estas rutas ya están protegidas por clerkAuth globalmente
// GET /api/organizations/current - Obtener organización actual
router.get('/api/organizations/current', getCurrentOrganization);

// GET /api/organizations - Listar todas las organizaciones del usuario
router.get('/api/organizations', getUserOrganizations);

// POST /api/organizations/switch - Cambiar organización activa
router.post('/api/organizations/switch', switchOrganization);

export default router;
