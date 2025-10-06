// src/controllers/authController.mjs
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import config from '../config/config.mjs';
import userModel from '../models/userModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Registra un nuevo usuario
 */
const register = async (req, res, next) => {
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
};

/**
 * Inicia sesión de usuario
 */
const login = async (req, res, next) => {
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
};

/**
 * Obtiene el perfil del usuario actual
 */
const getProfile = async (req, res, next) => {
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
};

/**
 * Actualiza el perfil del usuario actual
 */
const updateProfile = async (req, res, next) => {
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
    
    const { name, email, currentPassword, newPassword, position, location, address } = req.body;
    
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
    if (position !== undefined) updateData.position = position;
    if (location !== undefined) updateData.location = location;
    if (address !== undefined) updateData.address = address;
    
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
};

/**
 * Actualiza información meta del usuario (nombre, posición, ubicación)
 */
const updateMeta = async (req, res, next) => {
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

    const { name, position, location } = req.body;
    
    // Preparar datos para actualizar
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (position !== undefined) updateData.position = position;
    if (location !== undefined) updateData.location = location;

    // Si no hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    const updated = await userModel.update(req.user.id, updateData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Obtener usuario actualizado
    const updatedUser = await userModel.getById(req.user.id);
    
    res.json({
      success: true,
      message: 'Información actualizada exitosamente',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza información de dirección del usuario
 */
const updateAddress = async (req, res, next) => {
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

    const { address } = req.body;
    
    // Preparar datos para actualizar
    const updateData = {};
    if (address !== undefined) updateData.address = address;

    // Si no hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    const updated = await userModel.update(req.user.id, updateData);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Obtener usuario actualizado
    const updatedUser = await userModel.getById(req.user.id);
    
    res.json({
      success: true,
      message: 'Dirección actualizada exitosamente',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subir avatar del usuario (placeholder - implementar con multer)
 */
const uploadAvatar = async (req, res, next) => {
  try {
    // TODO: Implementar con multer para manejo de archivos
    // Por ahora, solo retornamos un mensaje de que la funcionalidad está en desarrollo
    
    res.status(501).json({
      success: false,
      message: 'Funcionalidad de upload de avatar en desarrollo'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Valida el token actual del usuario
 */
const validateToken = async (req, res, next) => {
  try {
    // El middleware authenticate ya validó el token
    // Obtenemos la información completa del usuario
    const user = await userModel.getById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Token válido',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cierra sesión del usuario (invalidar token del lado cliente)
 */
const logout = async (req, res, next) => {
  try {
    // En un sistema JWT stateless, el logout se maneja del lado cliente
    // eliminando el token. Aquí solo confirmamos la operación.
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Exportar como objeto default
export default {
  register,
  login,
  getProfile,
  updateProfile,
  updateMeta,
  updateAddress,
  uploadAvatar,
  validateToken,
  logout
};