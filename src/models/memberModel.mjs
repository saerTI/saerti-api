// src/models/memberModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Obtener miembros de una organización (desde BD local)
 * Para obtener la lista completa con roles, usar la API de Clerk
 */
export async function getMembers(organizationId) {
  const [rows] = await pool.query(
    `SELECT
       id,
       clerk_id,
       email,
       name,
       role,
       position,
       active,
       created_at
     FROM users
     WHERE organization_id = ?
     AND active = TRUE
     ORDER BY created_at ASC`,
    [organizationId]
  );

  return rows;
}

/**
 * Contar datos creados por un usuario en un tenant específico
 */
export async function countDataByUser(userId, organizationId) {
  const connection = await pool.getConnection();

  try {
    // Contar centros de costo
    const [costCenters] = await connection.query(
      `SELECT COUNT(*) as count
       FROM cost_centers
       WHERE owner_id = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // Contar proyectos
    const [projects] = await connection.query(
      `SELECT COUNT(*) as count
       FROM projects
       WHERE created_by = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // Contar ingresos
    const [incomes] = await connection.query(
      `SELECT COUNT(*) as count
       FROM incomes_data
       WHERE created_by = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // Contar egresos
    const [expenses] = await connection.query(
      `SELECT COUNT(*) as count
       FROM expenses_data
       WHERE created_by = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // Contar análisis de presupuesto
    const [budgetAnalyses] = await connection.query(
      `SELECT COUNT(*) as count
       FROM budget_analyses
       WHERE user_id = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // Contar costos contables
    const [accountingCosts] = await connection.query(
      `SELECT COUNT(*) as count
       FROM accounting_costs
       WHERE created_by = ? AND organization_id = ?`,
      [userId, organizationId]
    );

    // NOTA: No contamos income_types ni expense_types porque son datos compartidos
    // de la organización y no tienen columna created_by

    const counts = {
      costCenters: costCenters[0].count,
      projects: projects[0].count,
      incomes: incomes[0].count,
      expenses: expenses[0].count,
      budgetAnalyses: budgetAnalyses[0].count,
      accountingCosts: accountingCosts[0].count
    };

    counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return counts;

  } finally {
    connection.release();
  }
}

/**
 * Eliminar todos los datos de un usuario en un tenant específico
 * CUIDADO: Esta operación es DESTRUCTIVA e IRREVERSIBLE
 */
export async function deleteUserData(userId, organizationId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Eliminar análisis de presupuesto
    await connection.query(
      'DELETE FROM budget_analyses WHERE user_id = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // 2. Eliminar ingresos
    await connection.query(
      'DELETE FROM incomes_data WHERE created_by = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // 3. Eliminar egresos
    await connection.query(
      'DELETE FROM expenses_data WHERE created_by = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // 4. Eliminar costos contables
    await connection.query(
      'DELETE FROM accounting_costs WHERE created_by = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // 5. Eliminar proyectos
    await connection.query(
      'DELETE FROM projects WHERE created_by = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // 6. Eliminar centros de costo (después de proyectos por FK)
    await connection.query(
      'DELETE FROM cost_centers WHERE owner_id = ? AND organization_id = ?',
      [userId, organizationId]
    );

    // NOTA: Las categorías, tipos y estados son datos compartidos de la organización
    // No los eliminamos porque no pertenecen a un usuario específico
    // Solo eliminamos los datos transaccionales del usuario (ingresos, egresos, proyectos, etc.)

    await connection.commit();

    // Registrar en log (opcional)
    console.log(`✅ Datos eliminados para usuario ${userId} en organización ${organizationId}`);

    return true;

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error eliminando datos del usuario:', error);
    throw new Error('Error al eliminar datos del usuario');
  } finally {
    connection.release();
  }
}

/**
 * Verificar si un usuario es el único admin de una organización
 * (útil para prevenir auto-bloqueo en el futuro)
 */
export async function isOnlyAdmin(userId, organizationId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM users
     WHERE organization_id = ?
     AND role = 'admin'
     AND active = TRUE`,
    [organizationId]
  );

  return rows[0].count === 1;
}

/**
 * Actualizar organización de un usuario (cambiar de tenant)
 */
export async function updateUserOrganization(userId, newOrganizationId) {
  const [result] = await pool.query(
    `UPDATE users
     SET organization_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newOrganizationId, userId]
  );

  if (result.affectedRows === 0) {
    console.warn(`[updateUserOrganization] ⚠️ No se actualizó ningún usuario. userId: ${userId}`);
  }

  return result.affectedRows > 0;
}

/**
 * Obtener información de un usuario por clerk_id
 */
export async function getUserByClerkId(clerkId) {
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE clerk_id = ?`,
    [clerkId]
  );

  return rows[0];
}

/**
 * Obtener información de un usuario por email
 */
export async function getUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );

  return rows[0];
}

/**
 * Verificar si un usuario pertenece a una organización
 */
export async function isUserInOrganization(userId, organizationId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM users
     WHERE id = ? AND organization_id = ?`,
    [userId, organizationId]
  );

  return rows[0].count > 0;
}
