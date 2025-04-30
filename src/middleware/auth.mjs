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