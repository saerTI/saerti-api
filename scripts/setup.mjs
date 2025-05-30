import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import config from '../src/config/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let conn;

async function initializeConnection() {
  try {
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
    });
    
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [config.db.database, tableName]
    );
    return rows.length > 0;
  } catch (error) {
    return false;
  }
}

async function createPrevisionalTable() {
  try {
    const exists = await checkTableExists('previsionales');
    if (exists) {
      console.log('ℹ️ Tabla previsionales ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS previsionales (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        employee_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(100) NOT NULL,
        employee_rut VARCHAR(20) NOT NULL,
        project_id BIGINT UNSIGNED,
        project_name VARCHAR(100),
        project_code VARCHAR(20),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        date DATE NOT NULL,
        period VARCHAR(7) NOT NULL,
        state VARCHAR(50) DEFAULT 'pending',
        area VARCHAR(100),
        centro_costo VARCHAR(100),
        centro_costo_nombre VARCHAR(255),
        descuentos_legales DECIMAL(15,2),
        payment_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES construction_projects(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Tabla previsionales creada');
  } catch (error) {
    console.error('❌ Error al crear tabla previsionales:', error);
    throw error;
  }
}

async function createRemuneracionTable() {
  try {
    const exists = await checkTableExists('remuneraciones');
    if (exists) {
      console.log('ℹ️ Tabla remuneraciones ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS remuneraciones (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        employee_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(100) NOT NULL,
        employee_rut VARCHAR(20) NOT NULL,
        employee_position VARCHAR(100),
        project_id BIGINT UNSIGNED,
        project_name VARCHAR(100),
        project_code VARCHAR(20),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        sueldo_liquido DECIMAL(15,2),
        anticipo DECIMAL(15,2),
        date DATE NOT NULL,
        period VARCHAR(7) NOT NULL,
        work_days INT DEFAULT 30,
        payment_method VARCHAR(50) DEFAULT 'transfer',
        state VARCHAR(50) DEFAULT 'pending',
        area VARCHAR(100),
        payment_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES construction_projects(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Tabla remuneraciones creada');
  } catch (error) {
    console.error('❌ Error al crear tabla remuneraciones:', error);
    throw error;
  }
}

async function updateDatabase() {
  try {
    const connected = await initializeConnection();
    if (!connected) {
      process.exit(1);
    }
    
    await createPrevisionalTable();
    await createRemuneracionTable();
    
    console.log('\n✅ Actualización de la base de datos completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la actualización:', error);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

updateDatabase();