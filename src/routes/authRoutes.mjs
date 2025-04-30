import { Router } from 'express';
import { body } from 'express-validator';
import authController from '../controllers/authController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Público
 */
router.post(
  '/api/auth/register',
  [
    body('name')
      .notEmpty().withMessage('El nombre es obligatorio')
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .isEmail().withMessage('Debe proporcionar un email válido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión de usuario
 * @access  Público
 */
router.post(
  '/api/auth/login',
  [
    body('email')
      .isEmail().withMessage('Debe proporcionar un email válido')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
  ],
  authController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario actual
 * @access  Privado
 */
router.get(
  '/api/auth/profile',
  authenticate,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil del usuario actual
 * @access  Privado
 */
router.put(
  '/api/auth/profile',
  authenticate,
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email').optional().isEmail().withMessage('Debe proporcionar un email válido').normalizeEmail(),
    body('currentPassword').optional(),
    body('newPassword').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  authController.updateProfile
);

/**
 * @route   GET /api/admin/users
 * @desc    Obtener lista de usuarios (solo admin)
 * @access  Privado/Admin
 */
router.get(
  '/api/admin/users',
  authenticate,
  authorize('admin'),
  authController.listUsers
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Obtener usuario por ID (solo admin)
 * @access  Privado/Admin
 */
router.get(
  '/api/admin/users/:id',
  authenticate,
  authorize('admin'),
  authController.getUserById
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Actualizar usuario (solo admin)
 * @access  Privado/Admin
 */
router.put(
  '/api/admin/users/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email').optional().isEmail().withMessage('Debe proporcionar un email válido').normalizeEmail(),
    body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role').optional().isIn(['admin', 'manager', 'user']).withMessage('Rol inválido'),
    body('active').optional().isBoolean().withMessage('El estado activo debe ser un booleano')
  ],
  authController.updateUser
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Eliminar usuario (solo admin)
 * @access  Privado/Admin
 */
router.delete(
  '/api/admin/users/:id',
  authenticate,
  authorize('admin'),
  authController.deleteUser
);

export default router;