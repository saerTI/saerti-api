// src/routes/invitationRoutes.mjs
import { Router } from 'express';
import { clerkAuth } from '../middleware/clerkAuth.mjs';
import * as invitationController from '../controllers/invitationController.mjs';

const router = Router();

// ==========================================
// RUTAS DE GESTIÓN (requieren autenticación y admin)
// ==========================================

// Crear invitación
router.post(
  '/organizations/:orgId/invitations',
  clerkAuth,
  invitationController.create
);

// Listar invitaciones de una organización
router.get(
  '/organizations/:orgId/invitations',
  clerkAuth,
  invitationController.list
);

// Cancelar invitación
router.delete(
  '/organizations/:orgId/invitations/:id',
  clerkAuth,
  invitationController.cancel
);

// ==========================================
// RUTAS PÚBLICAS DE INVITACIÓN
// ==========================================

// Ver detalles de invitación (sin auth - para mostrar antes de login)
router.get(
  '/invitations/:token',
  invitationController.getByToken
);

// Preview de eliminación de datos (requiere auth)
router.post(
  '/invitations/:token/preview',
  clerkAuth,
  invitationController.preview
);

// Aceptar invitación (requiere auth)
router.post(
  '/invitations/:token/accept',
  clerkAuth,
  invitationController.accept
);

// Rechazar invitación (opcional auth)
router.post(
  '/invitations/:token/reject',
  invitationController.reject
);

export default router;
