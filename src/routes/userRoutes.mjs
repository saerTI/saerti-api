// src/routes/userRoutes.mjs
import { Router } from 'express';
import { body } from 'express-validator';
import userController from '../controllers/userController.mjs';
import { clerkAuth as authenticate, authorize } from '../middleware/clerkAuth.mjs';

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Obtener lista de usuarios con filtros (solo admin)
 * @access  Privado/Admin
 */
router.get(
  '/api/users',
  authenticate,
  authorize('admin'),
  userController.listUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Obtener estadísticas de usuarios (solo admin)
 * @access  Privado/Admin
 */
router.get(
  '/api/users/stats',
  authenticate,
  authorize('admin'),
  userController.getUserStats
);

/**
 * @route   GET /api/users/:id
 * @desc    Obtener usuario por ID (solo admin)
 * @access  Privado/Admin
 */
router.get(
  '/api/users/:id',
  authenticate,
  authorize('admin'),
  userController.getUserById
);

/**
 * @route   POST /api/users
 * @desc    Crear nuevo usuario (solo admin)
 * @access  Privado/Admin
 */
router.post(
  '/api/users',
  authenticate,
  authorize('admin'),
  [
    body('name')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .isEmail().withMessage('Debe proporcionar un email válido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role')
      .optional()
      .isIn(['admin', 'manager', 'user']).withMessage('Rol inválido')
  ],
  userController.createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar usuario completo (solo admin)
 * @access  Privado/Admin
 */
router.put(
  '/api/users/:id',
  authenticate,
  authorize('admin'),
  [
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Debe proporcionar un email válido')
      .normalizeEmail(),
    body('password')
      .optional()
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role')
      .optional()
      .isIn(['admin', 'manager', 'user']).withMessage('Rol inválido'),
    body('active')
      .optional()
      .isBoolean().withMessage('El estado activo debe ser un booleano')
  ],
  userController.updateUser
);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Cambiar estado activo/inactivo de usuario (solo admin)
 * @access  Privado/Admin
 */
router.patch(
  '/api/users/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('active')
      .isBoolean().withMessage('El estado activo debe ser un booleano')
  ],
  userController.toggleUserStatus
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar usuario (solo admin)
 * @access  Privado/Admin
 */
router.delete(
  '/api/users/:id',
  authenticate,
  authorize('admin'),
  userController.deleteUser
);

export default router;