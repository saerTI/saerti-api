// src/controllers/userController.mjs
import { validationResult } from 'express-validator';
import userModel from '../models/userModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Lista todos los usuarios (solo para administradores)
 */
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, active } = req.query;
    
    // Construir filtros
    const filters = {};
    if (search) filters.search = search;
    if (role) filters.role = role;
    if (active !== undefined) filters.active = active === 'true';
    
    const users = await userModel.listAll(page, limit, filters);
    
    res.json({
      success: true,
      data: users.data,
      pagination: users.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene un usuario por ID (solo para administradores)
 */
const getUserById = async (req, res, next) => {
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
};

/**
 * Crea un nuevo usuario (solo para administradores)
 */
const createUser = async (req, res, next) => {
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
    
    // Crear usuario
    const user = await userModel.create({
      name,
      email,
      password,
      role: role || 'user'
    });
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza un usuario (solo para administradores)
 */
const updateUser = async (req, res, next) => {
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
    
    // Evitar que se modifique a sí mismo para no quedar sin acceso
    if (id === req.user.id.toString()) {
      // No permitir cambiar su propio rol a algo que no sea admin
      if (role && role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'No puedes cambiar tu propio rol de administrador'
        });
      }
      
      // No permitir desactivarse a sí mismo
      if (active === false) {
        return res.status(400).json({
          success: false,
          message: 'No puedes desactivar tu propia cuenta'
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
};

/**
 * Elimina un usuario (solo para administradores)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // No permitir eliminar al propio usuario
    if (id === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }
    
    // Verificar que el usuario existe
    const userToDelete = await userModel.getById(id);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar si es el último administrador
    if (userToDelete.role === 'admin') {
      const adminCount = await userModel.countByRole('admin');
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar al último administrador del sistema'
        });
      }
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
};

/**
 * Activa/desactiva un usuario (solo para administradores)
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar el estado activo del usuario'
      });
    }
    
    // No permitir desactivarse a sí mismo
    if (id === req.user.id.toString() && active === false) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta'
      });
    }
    
    // Verificar que el usuario existe
    const user = await userModel.getById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar si es el último administrador activo
    if (user.role === 'admin' && active === false) {
      const activeAdminCount = await userModel.countActiveByRole('admin');
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No puedes desactivar al último administrador activo del sistema'
        });
      }
    }
    
    const updated = await userModel.update(id, { active });
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const updatedUser = await userModel.getById(id);
    
    res.json({
      success: true,
      message: `Usuario ${active ? 'activado' : 'desactivado'} exitosamente`,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene estadísticas de usuarios (solo para administradores)
 */
const getUserStats = async (req, res, next) => {
  try {
    const stats = await userModel.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Exportar como objeto default
export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats
};