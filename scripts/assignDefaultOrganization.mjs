// scripts/assignDefaultOrganization.mjs
// Script temporal para asignar organization_id por defecto a usuarios sin organización

import { pool } from '../src/config/database.mjs';

const DEFAULT_ORG_ID = 'org_default_temp';  // ID temporal de organización

async function assignDefaultOrganization() {
  try {
    console.log('🔧 Asignando organization_id por defecto a usuarios...\n');

    // Obtener usuarios sin organization_id
    const [usersWithoutOrg] = await pool.query(
      'SELECT id, email, name FROM users WHERE organization_id IS NULL'
    );

    if (usersWithoutOrg.length === 0) {
      console.log('✅ Todos los usuarios ya tienen organization_id asignado');
      return;
    }

    console.log(`📋 Encontrados ${usersWithoutOrg.length} usuarios sin organización:`);
    usersWithoutOrg.forEach(user => {
      console.log(`  - ${user.email} (${user.name})`);
    });

    // Asignar organization_id por defecto
    const [result] = await pool.query(
      'UPDATE users SET organization_id = ? WHERE organization_id IS NULL',
      [DEFAULT_ORG_ID]
    );

    console.log(`\n✅ Asignados ${result.affectedRows} usuarios a organization_id: "${DEFAULT_ORG_ID}"`);
    console.log('\n⚠️  NOTA: Este es un ID temporal. En producción, deberás usar IDs reales de Clerk.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

assignDefaultOrganization();
