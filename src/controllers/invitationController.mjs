// src/controllers/invitationController.mjs
import * as invitationModel from '../models/invitationModel.mjs';
import * as memberModel from '../models/memberModel.mjs';
import { sendInvitationEmail } from '../services/emailService.mjs';
import { clerkClient } from '@clerk/clerk-sdk-node';

/**
 * POST /api/organizations/:orgId/invitations
 * Crear nueva invitación
 */
export async function create(req, res) {
  try {
    const { orgId } = req.params;
    const { email, role = 'admin' } = req.body;
    const userId = req.user.id;
    const userOrgId = req.user.organization_id;

    // Validar que el usuario pertenece a la organización
    if (userOrgId !== orgId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para invitar a esta organización'
      });
    }

    // Validar que el usuario es admin de la organización
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden enviar invitaciones'
      });
    }

    // Validar email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Verificar que el email no esté ya en la organización
    const existingUser = await memberModel.getUserByEmail(email);
    if (existingUser && existingUser.organization_id === orgId) {
      return res.status(400).json({
        success: false,
        message: 'Este usuario ya pertenece a la organización'
      });
    }

    // Verificar que no haya una invitación pendiente
    const hasPending = await invitationModel.hasPendingInvitation(orgId, email);
    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una invitación pendiente para este email'
      });
    }

    // Obtener información de la organización desde Clerk
    let organizationName = 'Tu Organización';
    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId: orgId
      });
      organizationName = organization.name;
    } catch (error) {
      // Silenciar error Forbidden - es esperado si la API key no tiene permisos
      if (error.message !== 'Forbidden') {
        console.warn('No se pudo obtener nombre de org desde Clerk:', error.message);
      }
    }

    // Crear invitación
    const invitation = await invitationModel.create(
      orgId,
      email,
      role,
      userId
    );

    // Enviar email
    let emailSent = true;
    let emailError = null;
    try {
      await sendInvitationEmail(
        email,
        organizationName,
        req.user.name || req.user.email,
        invitation.token
      );
    } catch (error) {
      console.error('⚠️ Error enviando email (invitación creada de todos modos):', error.message);
      emailSent = false;
      emailError = error.message;
      // No fallar la invitación si el email falla
      // El usuario puede copiar el link manualmente
    }

    const invitationUrl = `${process.env.FRONTEND_URL}/invitations/accept?token=${invitation.token}`;

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Invitación enviada exitosamente'
        : 'Invitación creada (email no enviado - verifica tu configuración de Resend)',
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        invitation_url: invitationUrl,
        email_sent: emailSent,
        email_error: emailError
      }
    });

  } catch (error) {
    console.error('Error en create invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear invitación',
      error: error.message
    });
  }
}

/**
 * GET /api/organizations/:orgId/invitations
 * Listar invitaciones de una organización
 */
export async function list(req, res) {
  try {
    const { orgId } = req.params;
    const { status } = req.query;
    const userOrgId = req.user.organization_id;

    // Validar que el usuario pertenece a la organización
    if (userOrgId !== orgId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver invitaciones de esta organización'
      });
    }

    // Validar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden ver invitaciones'
      });
    }

    const invitations = await invitationModel.findByOrganization(orgId, status);

    res.json({
      success: true,
      data: invitations
    });

  } catch (error) {
    console.error('Error en list invitations:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar invitaciones',
      error: error.message
    });
  }
}

/**
 * DELETE /api/organizations/:orgId/invitations/:id
 * Cancelar invitación
 */
export async function cancel(req, res) {
  try {
    const { orgId, id } = req.params;
    const userOrgId = req.user.organization_id;

    // Validar que el usuario pertenece a la organización
    if (userOrgId !== orgId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cancelar invitaciones de esta organización'
      });
    }

    // Validar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden cancelar invitaciones'
      });
    }

    const cancelled = await invitationModel.cancel(id, orgId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada o ya fue procesada'
      });
    }

    res.json({
      success: true,
      message: 'Invitación cancelada exitosamente'
    });

  } catch (error) {
    console.error('Error en cancel invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar invitación',
      error: error.message
    });
  }
}

/**
 * GET /api/invitations/:token
 * Ver detalles de invitación (público - no requiere auth)
 */
export async function getByToken(req, res) {
  try {
    const { token } = req.params;

    const invitation = await invitationModel.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada'
      });
    }

    // Verificar si expiró
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ha expirado',
        expired: true
      });
    }

    // Verificar si ya fue procesada
    if (invitation.status !== 'pending') {
      return res.status(410).json({
        success: false,
        message: `Esta invitación ya fue ${invitation.status === 'accepted' ? 'aceptada' : 'rechazada'}`,
        status: invitation.status
      });
    }

    // Obtener información de la organización desde Clerk
    let organizationName = 'Organización';
    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId: invitation.organization_id
      });
      organizationName = organization.name;
    } catch (error) {
      // Silenciar error Forbidden - es esperado si la API key no tiene permisos
      if (error.message !== 'Forbidden') {
        console.warn('No se pudo obtener nombre de org desde Clerk:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        organization_id: invitation.organization_id,
        organization_name: organizationName,
        inviter_name: invitation.inviter_name,
        role: invitation.role,
        expires_at: invitation.expires_at,
        email: invitation.email
      }
    });

  } catch (error) {
    console.error('Error en getByToken:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener invitación',
      error: error.message
    });
  }
}

/**
 * POST /api/invitations/:token/preview
 * Preview de eliminación de datos (requiere auth)
 */
export async function preview(req, res) {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    const currentOrgId = req.user.organization_id;

    const invitation = await invitationModel.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada'
      });
    }

    // Verificar si expiró
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ha expirado'
      });
    }

    // Verificar si ya fue procesada
    if (invitation.status !== 'pending') {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ya fue procesada'
      });
    }

    const targetOrgId = invitation.organization_id;

    // Si el usuario ya está en la organización objetivo, no hay que eliminar nada
    if (currentOrgId === targetOrgId) {
      return res.json({
        success: true,
        data: {
          willDeleteData: false,
          message: 'Ya perteneces a esta organización'
        }
      });
    }

    // Contar datos del usuario en su organización actual
    const dataCount = await memberModel.countDataByUser(userId, currentOrgId);

    // Obtener nombres de organizaciones
    let currentOrgName = 'Tu organización actual';
    let targetOrgName = 'Nueva organización';

    try {
      const currentOrg = await clerkClient.organizations.getOrganization({
        organizationId: currentOrgId
      });
      currentOrgName = currentOrg.name;
    } catch (error) {
      console.warn('No se pudo obtener nombre de org actual:', error.message);
    }

    try {
      const targetOrg = await clerkClient.organizations.getOrganization({
        organizationId: targetOrgId
      });
      targetOrgName = targetOrg.name;
    } catch (error) {
      console.warn('No se pudo obtener nombre de org objetivo:', error.message);
    }

    res.json({
      success: true,
      data: {
        willDeleteData: dataCount.total > 0,
        currentOrganization: {
          id: currentOrgId,
          name: currentOrgName
        },
        targetOrganization: {
          id: targetOrgId,
          name: targetOrgName
        },
        dataToDelete: {
          costCenters: dataCount.costCenters,
          projects: dataCount.projects,
          incomes: dataCount.incomes,
          expenses: dataCount.expenses,
          budgetAnalyses: dataCount.budgetAnalyses,
          accountingCosts: dataCount.accountingCosts,
          incomeTypes: dataCount.incomeTypes,
          expenseTypes: dataCount.expenseTypes,
          total: dataCount.total
        }
      }
    });

  } catch (error) {
    console.error('Error en preview:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar preview',
      error: error.message
    });
  }
}

/**
 * POST /api/invitations/:token/accept
 * Aceptar invitación (requiere auth)
 */
export async function accept(req, res) {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    const clerkUserId = req.user.clerk_id;
    const currentOrgId = req.user.organization_id;

    const invitation = await invitationModel.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada'
      });
    }

    // Verificar si expiró
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ha expirado'
      });
    }

    // Verificar si ya fue procesada
    if (invitation.status !== 'pending') {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ya fue procesada'
      });
    }

    // Verificar que el email coincida
    if (invitation.email !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Esta invitación no es para tu email'
      });
    }

    const targetOrgId = invitation.organization_id;

    // Si el usuario tiene una organización diferente, eliminar sus datos
    if (currentOrgId && currentOrgId !== targetOrgId) {
      console.log(`🗑️ Eliminando datos del usuario ${userId} en organización ${currentOrgId}`);
      await memberModel.deleteUserData(userId, currentOrgId);
    }

    // Actualizar organización del usuario en BD local
    await memberModel.updateUserOrganization(userId, targetOrgId);

    // Agregar usuario a la organización en Clerk
    try {
      await clerkClient.organizations.createOrganizationMembership({
        organizationId: targetOrgId,
        userId: clerkUserId,
        role: invitation.role === 'admin' ? 'org:admin' : 'org:member'
      });
      console.log(`✅ Usuario agregado a org ${targetOrgId} en Clerk`);
    } catch (clerkError) {
      console.warn('Error agregando usuario a org en Clerk:', clerkError.message);
      // Continuar aunque falle Clerk, la BD local ya está actualizada
    }

    // Marcar invitación como aceptada
    await invitationModel.accept(token, userId);

    // Obtener información de la nueva organización
    let organizationName = 'Nueva Organización';
    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId: targetOrgId
      });
      organizationName = organization.name;
    } catch (error) {
      console.warn('No se pudo obtener nombre de org:', error.message);
    }

    res.json({
      success: true,
      message: 'Invitación aceptada exitosamente',
      data: {
        organization_id: targetOrgId,
        organization_name: organizationName,
        role: invitation.role
      }
    });

  } catch (error) {
    console.error('Error en accept invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aceptar invitación',
      error: error.message
    });
  }
}

/**
 * POST /api/invitations/:token/reject
 * Rechazar invitación
 */
export async function reject(req, res) {
  try {
    const { token } = req.params;

    const invitation = await invitationModel.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada'
      });
    }

    // Verificar si ya fue procesada
    if (invitation.status !== 'pending') {
      return res.status(410).json({
        success: false,
        message: 'Esta invitación ya fue procesada'
      });
    }

    await invitationModel.reject(token);

    res.json({
      success: true,
      message: 'Invitación rechazada'
    });

  } catch (error) {
    console.error('Error en reject invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Error al rechazar invitación',
      error: error.message
    });
  }
}
