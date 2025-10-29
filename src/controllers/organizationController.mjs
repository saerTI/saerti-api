// src/controllers/organizationController.mjs
import { clerkClient } from '@clerk/clerk-sdk-node';

/**
 * Obtener la organización actual del usuario autenticado
 */
export async function getCurrentOrganization(req, res) {
  try {
    const { organization_id, organizations } = req.user;

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no pertenece a ninguna organización'
      });
    }

    // Obtener detalles completos de la organización desde Clerk
    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId: organization_id
      });

      return res.json({
        success: true,
        data: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
          imageUrl: organization.imageUrl || null,
          publicMetadata: organization.publicMetadata || {},
          // Información del usuario en esta organización
          userRole: organizations.find(o => o.id === organization_id)?.role || 'member'
        }
      });
    } catch (clerkError) {
      console.error('[Organization Controller] Error fetching from Clerk:', clerkError.message);

      // Fallback: devolver información básica del req.user
      return res.json({
        success: true,
        data: {
          id: organization_id,
          name: `Organization ${organization_id}`,
          slug: organization_id,
          userRole: 'admin'
        }
      });
    }
  } catch (error) {
    console.error('[Organization Controller] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener información de la organización'
    });
  }
}

/**
 * Listar todas las organizaciones del usuario
 */
export async function getUserOrganizations(req, res) {
  try {
    const { organizations } = req.user;

    return res.json({
      success: true,
      data: organizations || []
    });
  } catch (error) {
    console.error('[Organization Controller] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener organizaciones del usuario'
    });
  }
}

/**
 * Cambiar la organización activa del usuario
 * Actualiza el organization_id en la BD local
 */
export async function switchOrganization(req, res) {
  try {
    const { organizationId } = req.body;
    const { id: userId, organizations } = req.user;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'organizationId es requerido'
      });
    }

    // Verificar que el usuario pertenece a esta organización
    const isMember = organizations.some(org => org.id === organizationId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta organización'
      });
    }

    // Actualizar organization_id en la BD local
    const { pool } = await import('../config/database.mjs');
    await pool.query(
      'UPDATE users SET organization_id = ? WHERE id = ?',
      [organizationId, userId]
    );

    return res.json({
      success: true,
      message: 'Organización cambiada exitosamente',
      data: {
        organizationId
      }
    });
  } catch (error) {
    console.error('[Organization Controller] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar de organización'
    });
  }
}
