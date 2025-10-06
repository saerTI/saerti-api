// src/routes/authRoutes.mjs
import { Router } from 'express';
import { body } from 'express-validator';
import authController from '../controllers/authController.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario (público o admin)
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
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role')
      .optional()
      .isIn(['admin', 'manager', 'user']).withMessage('Rol inválido')
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
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión de usuario
 * @access  Privado
 */
router.post(
  '/api/auth/logout',
  authenticate,
  authController.logout
);

/**
 * @route   GET /api/auth/validate
 * @desc    Validar token actual
 * @access  Privado
 */
router.get(
  '/api/auth/validate',
  authenticate,
  authController.validateToken
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
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('email')
      .optional()
      .isEmail().withMessage('Debe proporcionar un email válido')
      .normalizeEmail(),
    body('currentPassword')
      .optional(),
    body('newPassword')
      .optional()
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('position')
      .optional()
      .isLength({ max: 100 }).withMessage('La posición no debe exceder 100 caracteres'),
    body('location')
      .optional()
      .isLength({ max: 200 }).withMessage('La ubicación no debe exceder 200 caracteres'),
    body('country')
      .optional()
      .isLength({ max: 100 }).withMessage('El país no debe exceder 100 caracteres'),
    body('city')
      .optional()
      .isLength({ max: 100 }).withMessage('La ciudad no debe exceder 100 caracteres'),
    body('postal_code')
      .optional()
      .isLength({ max: 20 }).withMessage('El código postal no debe exceder 20 caracteres'),
    body('address')
      .optional()
      .isLength({ max: 255 }).withMessage('La dirección no debe exceder 255 caracteres')
  ],
  authController.updateProfile
);

/**
 * @route   PATCH /api/auth/profile/meta
 * @desc    Actualizar información meta del usuario (nombre, posición, ubicación)
 * @access  Privado
 */
router.patch(
  '/api/auth/profile/meta',
  authenticate,
  [
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
    body('position')
      .optional()
      .isLength({ max: 100 }).withMessage('La posición no debe exceder 100 caracteres'),
    body('location')
      .optional()
      .isLength({ max: 200 }).withMessage('La ubicación no debe exceder 200 caracteres')
  ],
  authController.updateMeta
);

/**
 * @route   PATCH /api/auth/profile/address
 * @desc    Actualizar información de dirección del usuario
 * @access  Privado
 */
router.patch(
  '/api/auth/profile/address',
  authenticate,
  [
    body('city')
      .optional()
      .isLength({ max: 100 }).withMessage('La ciudad no debe exceder 100 caracteres'),
    body('postal_code')
      .optional()
      .isLength({ max: 20 }).withMessage('El código postal no debe exceder 20 caracteres'),
    body('address')
      .optional()
      .isLength({ max: 255 }).withMessage('La dirección no debe exceder 255 caracteres')
  ],
  authController.updateAddress
);

/**
 * @route   POST /api/auth/profile/avatar
 * @desc    Subir avatar del usuario
 * @access  Privado
 */
router.post(
  '/api/auth/profile/avatar',
  authenticate,
  authController.uploadAvatar
);

export default router;