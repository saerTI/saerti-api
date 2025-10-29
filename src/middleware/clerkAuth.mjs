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
        message: 'Autenticación requerida' 
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

    // Obtener usuario de Clerk
    let clerkUser, clerkEmail, clerkName, clerkOrganizations = [];
    try {
      clerkUser = await clerkClient.users.getUser(sessionClaims.sub);
      clerkEmail = clerkUser.emailAddresses[0]?.emailAddress || null;
      clerkName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Usuario';

      // Obtener organizaciones del usuario desde Clerk
      try {
        const orgMemberships = await clerkClient.users.getOrganizationMembershipList({
          userId: sessionClaims.sub
        });
        clerkOrganizations = orgMemberships.data || [];
      } catch (orgError) {
        console.warn('[Clerk Auth] ⚠️ No se pudieron obtener organizaciones:', orgError.message);
      }
    } catch (userError) {
      console.warn('[Clerk Auth] ⚠️ Usando claims del token');
      clerkEmail = sessionClaims.email || null;
      clerkName = 'Usuario';
    }

    // Determinar organization_id (crear una si no existe)
    let organizationId = null;

    if (clerkOrganizations.length > 0) {
      // Usar la primera organización activa
      organizationId = clerkOrganizations[0].organization.id;
      console.log(`[Clerk Auth] ✅ Usuario pertenece a organización: ${organizationId}`);
    } else {
      // Auto-crear organización personal si no tiene ninguna
      try {
        const newOrg = await clerkClient.organizations.createOrganization({
          name: `${clerkName}'s Organization`,
          createdBy: sessionClaims.sub
        });
        organizationId = newOrg.id;
        console.log(`[Clerk Auth] ✅ Organización creada automáticamente: ${organizationId}`);
      } catch (createOrgError) {
        console.error('[Clerk Auth] ❌ No se pudo crear organización:', createOrgError.message);
        // Usar un ID temporal basado en el usuario si falla
        organizationId = `user_${sessionClaims.sub}`;
      }
    }

    // Sincronizar con BD local (con manejo de race conditions)
    let [localUsers] = await pool.query(
      'SELECT * FROM users WHERE clerk_id = ?',
      [sessionClaims.sub]
    );

    let localUser;

    if (!localUsers || localUsers.length === 0) {
      try {
        const [result] = await pool.query(
          `INSERT IGNORE INTO users (clerk_id, email, name, role, active, organization_id)
           VALUES (?, ?, ?, ?, TRUE, ?)`,
          [sessionClaims.sub, clerkEmail || 'sin-email@temp.com', clerkName, 'admin', organizationId]
        );

        if (result.insertId === 0) {
          [localUsers] = await pool.query('SELECT * FROM users WHERE clerk_id = ?', [sessionClaims.sub]);
        } else {
          [localUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        }
        localUser = localUsers[0];
      } catch (insertError) {
        [localUsers] = await pool.query('SELECT * FROM users WHERE clerk_id = ?', [sessionClaims.sub]);
        if (!localUsers?.[0]) throw new Error('No se pudo crear el usuario');
        localUser = localUsers[0];
      }
    } else {
      localUser = localUsers[0];

      // Actualizar organization_id si cambió o no existía
      if (!localUser.organization_id || localUser.organization_id !== organizationId) {
        await pool.query(
          'UPDATE users SET organization_id = ? WHERE id = ?',
          [organizationId, localUser.id]
        );
        localUser.organization_id = organizationId;
        console.log(`[Clerk Auth] ✅ Organization ID actualizado para usuario ${localUser.id}`);
      }
    }

    req.user = {
      id: localUser.id,
      clerk_id: sessionClaims.sub,
      name: localUser.name,
      email: localUser.email,
      role: localUser.role,
      active: localUser.active,
      organization_id: localUser.organization_id || organizationId,
      organizationId: localUser.organization_id || organizationId,  // Alias para compatibilidad
      organizations: clerkOrganizations.map(om => ({
        id: om.organization.id,
        name: om.organization.name,
        role: om.role
      }))
    };

    next();

  } catch (error) {
    console.error('[Clerk Auth] Error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Error de autenticación'
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