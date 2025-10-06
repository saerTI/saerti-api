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
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Autenticación requerida. Por favor proporcione un token válido.' 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar token con Clerk
    const sessionClaims = await clerkClient.verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    if (!sessionClaims) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido o expirado' 
      });
    }

    // Obtener usuario completo de Clerk
    const clerkUser = await clerkClient.users.getUser(sessionClaims.sub);
    
    // Obtener organizaciones (multi-tenancy)
    const orgMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: clerkUser.id,
      limit: 10
    });

    // Organización activa (desde header o primera disponible)
    const activeOrgId = req.headers['x-organization-id'] || 
                        orgMemberships.data?.[0]?.organization?.id || 
                        null;

    // Sincronizar con BD local
    let [localUsers] = await pool.query(
      'SELECT * FROM users WHERE clerk_id = ?',
      [clerkUser.id]
    );

    let localUser;

    if (!localUsers || localUsers.length === 0) {
      // Crear usuario local
      const [result] = await pool.query(
        `INSERT INTO users (clerk_id, email, name, role, organization_id, active) 
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [
          clerkUser.id,
          clerkUser.emailAddresses[0]?.emailAddress || '',
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Usuario',
          'user',
          activeOrgId
        ]
      );
      
      [localUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      localUser = localUsers[0];
      
      console.log(`[Clerk] ✅ Nuevo usuario creado: ${localUser.email}`);
    } else {
      localUser = localUsers[0];
      
      // Actualizar organización si cambió
      if (localUser.organization_id !== activeOrgId) {
        await pool.query(
          'UPDATE users SET organization_id = ? WHERE id = ?',
          [activeOrgId, localUser.id]
        );
        localUser.organization_id = activeOrgId;
      }
    }

    // Formato compatible con middleware JWT legacy
    req.user = {
      id: localUser.id,
      clerk_id: clerkUser.id,
      name: localUser.name,
      email: localUser.email,
      role: localUser.role,
      active: localUser.active,
      organizationId: activeOrgId,
      organizations: orgMemberships.data?.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role
      })) || []
    };

    next();

  } catch (error) {
    console.error('[Clerk Auth] Error:', error.message);
    
    if (error.message?.includes('expired') || error.message?.includes('JWT')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado' 
      });
    }
    
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