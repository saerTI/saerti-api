// src/models/invitationModel.mjs
import { pool } from '../config/database.mjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Crear una nueva invitación
 */
export async function create(organizationId, email, role, invitedBy) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

  const [result] = await pool.query(
    `INSERT INTO organization_invitations
     (organization_id, email, role, invited_by, token, expires_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [organizationId, email, role, invitedBy, token, expiresAt]
  );

  return {
    id: result.insertId,
    organization_id: organizationId,
    email,
    role,
    invited_by: invitedBy,
    token,
    expires_at: expiresAt,
    status: 'pending'
  };
}

/**
 * Buscar invitación por token
 */
export async function findByToken(token) {
  const [rows] = await pool.query(
    `SELECT i.*, u.name as inviter_name
     FROM organization_invitations i
     LEFT JOIN users u ON i.invited_by = u.id
     WHERE i.token = ?`,
    [token]
  );

  return rows[0];
}

/**
 * Listar invitaciones de una organización
 */
export async function findByOrganization(organizationId, status = null) {
  let query = `
    SELECT i.*, u.name as inviter_name, u.email as inviter_email
    FROM organization_invitations i
    LEFT JOIN users u ON i.invited_by = u.id
    WHERE i.organization_id = ?
  `;
  const params = [organizationId];

  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }

  query += ' ORDER BY i.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Buscar invitaciones pendientes por email
 */
export async function findPendingByEmail(email) {
  const [rows] = await pool.query(
    `SELECT i.*, u.name as inviter_name
     FROM organization_invitations i
     LEFT JOIN users u ON i.invited_by = u.id
     WHERE i.email = ?
     AND i.status = 'pending'
     AND i.expires_at > NOW()
     ORDER BY i.created_at DESC`,
    [email]
  );

  return rows;
}

/**
 * Verificar si un email ya tiene invitación pendiente en una organización
 */
export async function hasPendingInvitation(organizationId, email) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM organization_invitations
     WHERE organization_id = ?
     AND email = ?
     AND status = 'pending'
     AND expires_at > NOW()`,
    [organizationId, email]
  );

  return rows[0].count > 0;
}

/**
 * Aceptar invitación
 */
export async function accept(token, userId = null) {
  const [result] = await pool.query(
    `UPDATE organization_invitations
     SET status = 'accepted', accepted_at = NOW()
     WHERE token = ?
     AND status = 'pending'
     AND expires_at > NOW()`,
    [token]
  );

  return result.affectedRows > 0;
}

/**
 * Rechazar invitación
 */
export async function reject(token) {
  const [result] = await pool.query(
    `UPDATE organization_invitations
     SET status = 'rejected'
     WHERE token = ?
     AND status = 'pending'`,
    [token]
  );

  return result.affectedRows > 0;
}

/**
 * Cancelar invitación (marcar como expirada)
 */
export async function cancel(invitationId, organizationId) {
  const [result] = await pool.query(
    `UPDATE organization_invitations
     SET status = 'expired'
     WHERE id = ?
     AND organization_id = ?
     AND status = 'pending'`,
    [invitationId, organizationId]
  );

  return result.affectedRows > 0;
}

/**
 * Marcar invitaciones expiradas automáticamente
 */
export async function expireOld() {
  const [result] = await pool.query(
    `UPDATE organization_invitations
     SET status = 'expired'
     WHERE status = 'pending'
     AND expires_at < NOW()`
  );

  return result.affectedRows;
}

/**
 * Obtener invitación por ID
 */
export async function findById(invitationId, organizationId) {
  const [rows] = await pool.query(
    `SELECT i.*, u.name as inviter_name
     FROM organization_invitations i
     LEFT JOIN users u ON i.invited_by = u.id
     WHERE i.id = ? AND i.organization_id = ?`,
    [invitationId, organizationId]
  );

  return rows[0];
}

/**
 * Eliminar invitación (hard delete - usar con cuidado)
 */
export async function deleteById(invitationId, organizationId) {
  const [result] = await pool.query(
    `DELETE FROM organization_invitations
     WHERE id = ? AND organization_id = ?`,
    [invitationId, organizationId]
  );

  return result.affectedRows > 0;
}

/**
 * Obtener estadísticas de invitaciones de una organización
 */
export async function getStats(organizationId) {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'pending' AND expires_at > NOW() THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
       SUM(CASE WHEN status = 'expired' OR (status = 'pending' AND expires_at <= NOW()) THEN 1 ELSE 0 END) as expired
     FROM organization_invitations
     WHERE organization_id = ?`,
    [organizationId]
  );

  return rows[0];
}
