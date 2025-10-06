// src/middleware/clerkAuth.mjs
import { clerkClient } from '@clerk/clerk-sdk-node';
import { pool } from '../config/database.mjs';

/**
 * Middleware de autenticación Clerk (reemplaza JWT)
 * Mantiene compatibilidad con el formato req.user legacy
 */
export const clerkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('[Clerk Auth] Request:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : 'NONE'
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Clerk Auth] ❌ No Bearer token en header');
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticación requerida. Por favor proporcione un token válido.' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Clerk Auth] Token extraído:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 30) + '...'
    });

    // Verificar token con Clerk
    const sessionClaims = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    console.log('[Clerk Auth] ✅ Token verificado:', {
      userId: sessionClaims.sub,
      claims: sessionClaims
    });

    if (!sessionClaims) {
      console.error('[Clerk Auth] ❌ sessionClaims es null');
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido o expirado' 
      });
    }

    // ... resto del código
    
  } catch (error) {
    console.error('[Clerk Auth] 🚨 ERROR CRÍTICO:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(401).json({ 
      success: false, 
      message: 'Error de autenticación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware de autorización por rol (mantiene compatibilidad total)
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
 * Middleware owner o admin (mantiene compatibilidad)
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
 * Middleware admin o manager (mantiene compatibilidad)
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
 * Solo lectura (mantiene compatibilidad)
 */
export const authorizeReadOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Autenticación requerida' 
    });
  }
  next();
};

/**
 * Bloquear escritura para usuarios (mantiene compatibilidad)
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

/**
 * Middleware para requerir organización (multi-tenant)
 */
export const requireOrganization = (req, res, next) => {
  if (!req.user?.organizationId) {
    return res.status(403).json({
      success: false,
      message: 'Debes pertenecer a una organización para acceder a este recurso'
    });
  }
  next();
};