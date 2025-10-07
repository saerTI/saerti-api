// migrate-user-constraints.mjs
// Ejecutar: node migrate-user-constraints.mjs

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

async function runMigration() {
  let connection;
  
  try {
    console.log('\n🔧 MIGRACIÓN: Arreglar constraints de tabla users\n');
    console.log('📋 Configuración de BD:');
    console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    console.log(`   User: ${DB_CONFIG.user}\n`);

    // Conectar a la base de datos
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conexión establecida\n');

    // PASO 1: Ver estructura actual
    console.log('📊 PASO 1: Verificando estructura actual de la tabla users...');
    const [columns] = await connection.query('DESCRIBE users');
    console.log('\nColumnas actuales:');
    columns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Key ? `[${col.Key}]` : ''} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Ver índices actuales
    const [indexes] = await connection.query('SHOW INDEX FROM users');
    console.log('\nÍndices actuales:');
    const uniqueIndexes = new Set();
    indexes.forEach(idx => {
      if (idx.Non_unique === 0) uniqueIndexes.add(idx.Key_name);
      console.log(`   ${idx.Key_name} en columna ${idx.Column_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX'})`);
    });

    // PASO 2: Verificar si clerk_id ya tiene UNIQUE constraint
    console.log('\n🔍 PASO 2: Verificando constraint UNIQUE en clerk_id...');
    const hasClerkIdUnique = uniqueIndexes.has('unique_clerk_id') || uniqueIndexes.has('clerk_id');
    
    if (hasClerkIdUnique) {
      console.log('✅ clerk_id ya tiene constraint UNIQUE');
    } else {
      console.log('⚠️  clerk_id NO tiene constraint UNIQUE, agregando...');
      try {
        await connection.query('ALTER TABLE users ADD UNIQUE KEY unique_clerk_id (clerk_id)');
        console.log('✅ Constraint UNIQUE agregado a clerk_id');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('✅ Constraint ya existía con otro nombre');
        } else {
          throw error;
        }
      }
    }

    // PASO 3: Eliminar UNIQUE constraint del email
    console.log('\n🔍 PASO 3: Verificando constraint UNIQUE en email...');
    const hasEmailUnique = uniqueIndexes.has('email');
    
    if (hasEmailUnique) {
      console.log('⚠️  email tiene constraint UNIQUE, eliminando...');
      try {
        await connection.query('ALTER TABLE users DROP INDEX email');
        console.log('✅ Constraint UNIQUE eliminado de email');
      } catch (error) {
        console.error('❌ Error al eliminar UNIQUE de email:', error.message);
        throw error;
      }
    } else {
      console.log('✅ email NO tiene constraint UNIQUE (correcto)');
    }

    // PASO 4: Agregar índice normal al email
    console.log('\n🔍 PASO 4: Verificando índice en email...');
    const hasEmailIndex = indexes.some(idx => idx.Column_name === 'email' && idx.Non_unique === 1);
    
    if (hasEmailIndex) {
      console.log('✅ email ya tiene un índice normal');
    } else {
      console.log('⚠️  email NO tiene índice, agregando...');
      try {
        await connection.query('ALTER TABLE users ADD INDEX idx_email (email)');
        console.log('✅ Índice normal agregado a email');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('✅ Índice ya existía');
        } else {
          throw error;
        }
      }
    }

    // PASO 5: Verificar resultado final
    console.log('\n📊 PASO 5: Verificando estructura final...');
    const [finalIndexes] = await connection.query('SHOW INDEX FROM users');
    console.log('\nÍndices finales:');
    finalIndexes.forEach(idx => {
      console.log(`   ${idx.Key_name} en ${idx.Column_name} (${idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX'})`);
    });

    // PASO 6: Contar usuarios
    const [countResult] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Total de usuarios en la base de datos: ${countResult[0].count}`);

    // PASO 7: Verificar usuarios duplicados por clerk_id
    const [duplicates] = await connection.query(`
      SELECT clerk_id, COUNT(*) as count 
      FROM users 
      GROUP BY clerk_id 
      HAVING count > 1
    `);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  ATENCIÓN: Se encontraron clerk_id duplicados:');
      duplicates.forEach(dup => {
        console.log(`   clerk_id: ${dup.clerk_id} - ${dup.count} ocurrencias`);
      });
      console.log('\n🔧 Recomendación: Limpia los duplicados manualmente antes de continuar');
    } else {
      console.log('\n✅ No se encontraron clerk_id duplicados');
    }

    console.log('\n✅ MIGRACIÓN COMPLETADA CON ÉXITO\n');
    console.log('📝 Resumen de cambios:');
    console.log('   1. clerk_id ahora tiene constraint UNIQUE');
    console.log('   2. email ya NO tiene constraint UNIQUE');
    console.log('   3. email tiene un índice normal para búsquedas rápidas\n');

  } catch (error) {
    console.error('\n❌ ERROR EN LA MIGRACIÓN:');
    console.error('   Mensaje:', error.message);
    console.error('   Código:', error.code);
    console.error('   SQL State:', error.sqlState);
    console.error('\n   Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada\n');
    }
  }
}

// Ejecutar migración
runMigration().catch(console.error);