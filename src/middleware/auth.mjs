// src/middleware/auth.mjs
import jwt from 'jsonwebtoken';
import config from '../config/config.mjs';
import { pool } from '../config/database.mjs';

/**
 * Middleware de autenticación que verifica el token JWT
 */
export const authenticate = async (req, res, next) => {
  try {
    // Verificar si existe el encabezado de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticación requerida. Por favor proporcione un token válido.' 
      });
    }

    // Extraer y verificar el token
    const token = authHeader.split(' ')[1];
    // console.log(`Token: ${token}`);
    
    const decoded = jwt.verify(token, config.jwt.secret);

    // Verificar si el usuario existe y está activo
    const [users] = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = ? AND active = TRUE',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no encontrado o inactivo' 
      });
    }

    // Adjuntar usuario a la solicitud
    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Error de autenticación',
      error: error.message
    });
  }
};

/**
 * Middleware de autorización que verifica el rol del usuario
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticación requerida' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para realizar esta acción' 
      });
    }
    
    next();
  };
};

/**
 * Middleware que permite acceso a admins y al usuario propietario del recurso
 * @param {string} paramName - Nombre del parámetro que contiene el ID del usuario
 */
export const authorizeOwnerOrAdmin = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticación requerida' 
      });
    }
    
    const resourceUserId = req.params[paramName];
    const isOwner = req.user.id.toString() === resourceUserId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para acceder a este recurso' 
      });
    }
    
    next();
  };
};

/**
 * Middleware para verificar si el usuario es administrador o manager
 */
export const authorizeAdminOrManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Autenticación requerida' 
    });
  }
  
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso restringido a administradores y managers' 
    });
  }
  
  next();
};

/**
 * Middleware para solo lectura - permite a todos los usuarios autenticados ver
 */
export const authorizeReadOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Autenticación requerida' 
    });
  }
  
  // Todos los usuarios autenticados pueden leer
  next();
};

/**
 * Middleware que bloquea a usuarios con rol 'user' para operaciones de escritura
 */
export const blockUserRoleWrite = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Autenticación requerida' 
    });
  }
  
  if (req.user.role === 'user') {
    return res.status(403).json({ 
      success: false, 
      message: 'Los usuarios base solo tienen permisos de lectura' 
    });
  }
  
  next();
};