import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import config from '../config/config.mjs';
import userModel from '../models/userModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para autenticación y gestión de usuarios
 */
export default {
  /**
   * Registra un nuevo usuario
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async register(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { name, email, password, role } = req.body;
      
      // Verificar si el usuario ya existe
      const existingUser = await userModel.getByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'El correo electrónico ya está registrado'
        });
      }
      
      // Validar rol si se proporciona (solo administradores pueden crear otros administradores)
      if (role === 'admin' && (!req.user || req.user.role !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para crear usuarios administradores'
        });
      }
      
      // Crear usuario
      const user = await userModel.create({
        name,
        email,
        password,
        role: role || 'user'
      });
      
      // Generar token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: { user, token }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Inicia sesión de usuario
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async login(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { email, password } = req.body;
      
      // Autenticar usuario
      const user = await userModel.authenticate(email, password);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }
      
      // Generar token
      const token = jwt.sign(
        { id: user.id, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      
      res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: { user, token }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene el perfil del usuario actual
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProfile(req, res, next) {
    try {
      const user = await userModel.getById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el perfil del usuario actual
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateProfile(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { name, email, currentPassword, newPassword } = req.body;
      
      // Verificar contraseña actual si se intenta cambiar la contraseña
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Se requiere la contraseña actual para cambiar la contraseña'
          });
        }
        
        const user = await userModel.getByEmail(req.user.email);
        const authenticated = await userModel.authenticate(user.email, currentPassword);
        
        if (!authenticated) {
          return res.status(401).json({
            success: false,
            message: 'Contraseña actual incorrecta'
          });
        }
      }
      
      // Verificar si el nuevo email ya está en uso
      if (email && email !== req.user.email) {
        const existingUser = await userModel.getByEmail(email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'El correo electrónico ya está en uso'
          });
        }
      }
      
      // Actualizar perfil
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (newPassword) updateData.password = newPassword;
      
      const updated = await userModel.update(req.user.id, updateData);
      
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Obtener perfil actualizado
      const updatedUser = await userModel.getById(req.user.id);
      
      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lista todos los usuarios (solo para administradores)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async listUsers(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const users = await userModel.listAll(page, limit);
      
      res.json({
        success: true,
        data: users.data,
        pagination: users.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un usuario por ID (solo para administradores)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      
      const user = await userModel.getById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un usuario (solo para administradores)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateUser(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      const { name, email, password, role, active } = req.body;
      
      // Verificar si el usuario existe
      const existingUser = await userModel.getById(id);
      
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      // Verificar si el nuevo email ya está en uso
      if (email && email !== existingUser.email) {
        const userWithEmail = await userModel.getByEmail(email);
        if (userWithEmail) {
          return res.status(409).json({
            success: false,
            message: 'El correo electrónico ya está en uso'
          });
        }
      }
      
      // Actualizar usuario
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (role) updateData.role = role;
      if (active !== undefined) updateData.active = active;
      
      const updated = await userModel.update(id, updateData);
      
      // Obtener usuario actualizado
      const updatedUser = await userModel.getById(id);
      
      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Elimina un usuario (solo para administradores)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      
      // No permitir eliminar al propio usuario
      if (id === req.user.id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propia cuenta'
        });
      }
      
      const deleted = await userModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
};