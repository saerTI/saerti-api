// src/routes/companyUsersRoutes.mjs
import { Router } from 'express';
import { body } from 'express-validator';
import companyUsersController from '../controllers/companyUsersController.mjs';
import { authenticate, authorize } from '../middleware/auth.mjs';

const router = Router();

/**
 * @route   GET /api/companies/:company_id/users
 * @desc    Listar usuarios de una compañía
 * @access  Privado (Admin o Admin de Compañía)
 */
router.get(
  '/api/companies/:company_id/users',
  authenticate,
  companyUsersController.listCompanyUsers
);

/**
 * @route   POST /api/companies/:company_id/users
 * @desc    Crear usuario para una compañía
 * @access  Privado (Admin o Admin de Compañía)
 */
router.post(
  '/api/companies/:company_id/users',
  authenticate,
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
      .isIn(['admin', 'manager', 'user']).withMessage('Rol inválido'),
    body('position')
      .optional()
      .isLength({ max: 100 }).withMessage('La posición debe tener máximo 100 caracteres')
  ],
  companyUsersController.createCompanyUser
);

/**
 * @route   PUT /api/company-users/:id
 * @desc    Actualizar usuario de compañía
 * @access  Privado (Admin o Admin de Compañía)
 */
router.put(
  '/api/company-users/:id',
  authenticate,
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
    body('position')
      .optional()
      .isLength({ max: 100 }).withMessage('La posición debe tener máximo 100 caracteres'),
    body('active')
      .optional()
      .isBoolean().withMessage('El campo activo debe ser un booleano')
  ],
  companyUsersController.updateCompanyUser
);

/**
 * @route   DELETE /api/company-users/:id
 * @desc    Eliminar usuario de compañía
 * @access  Privado (Admin o Admin de Compañía)
 */
router.delete(
  '/api/company-users/:id',
  authenticate,
  companyUsersController.deleteCompanyUser
);

export default router;