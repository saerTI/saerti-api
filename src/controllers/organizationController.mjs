// src/controllers/organizationController.mjs
import { clerkClient } from '@clerk/clerk-sdk-node';
import * as memberModel from '../models/memberModel.mjs';

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

/**
 * Listar miembros de una organización
 * GET /api/organizations/:orgId/members
 */
export async function getMembers(req, res) {
  try {
    const { orgId } = req.params;
    const userOrgId = req.user.organization_id;

    // Validar que el usuario pertenece a la organización
    if (userOrgId !== orgId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver los miembros de esta organización'
      });
    }

    // Obtener miembros desde Clerk (con roles)
    let clerkMembers = [];
    try {
      const organizationMemberships = await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        limit: 100
      });

      clerkMembers = organizationMemberships.data.map(membership => ({
        clerkUserId: membership.publicUserData.userId,
        email: membership.publicUserData.identifier,
        firstName: membership.publicUserData.firstName,
        lastName: membership.publicUserData.lastName,
        imageUrl: membership.publicUserData.imageUrl,
        role: membership.role, // 'org:admin' | 'org:member'
        joinedAt: membership.createdAt
      }));
    } catch (clerkError) {
      console.warn('Error obteniendo miembros desde Clerk:', clerkError.message);
    }

    // Obtener miembros desde BD local
    const localMembers = await memberModel.getMembers(orgId);

    // Combinar información de Clerk con BD local
    const members = [];

    for (const localMember of localMembers) {
      const clerkMember = clerkMembers.find(cm => cm.clerkUserId === localMember.clerk_id);

      // Contar datos del miembro
      let dataCount = { total: 0 };
      try {
        dataCount = await memberModel.countDataByUser(localMember.id, orgId);
      } catch (error) {
        console.warn(`Error contando datos del usuario ${localMember.id}:`, error.message);
      }

      members.push({
        id: localMember.id,
        clerk_id: localMember.clerk_id,
        email: localMember.email,
        name: localMember.name,
        role: clerkMember?.role || localMember.role, // Priorizar rol de Clerk
        avatar: clerkMember?.imageUrl || null,
        position: localMember.position,
        joinedAt: clerkMember?.joinedAt || localMember.created_at,
        dataCount: {
          costCenters: dataCount.costCenters || 0,
          projects: dataCount.projects || 0,
          incomes: dataCount.incomes || 0,
          expenses: dataCount.expenses || 0,
          budgetAnalyses: dataCount.budgetAnalyses || 0,
          total: dataCount.total || 0
        }
      });
    }

    return res.json({
      success: true,
      data: members
    });

  } catch (error) {
    console.error('[Organization Controller] Error getting members:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener miembros de la organización',
      error: error.message
    });
  }
}
