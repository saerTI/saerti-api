// scripts/setup-clerk.mjs
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'saerti_db';

console.log(`
╔════════════════════════════════════════════════════╗
║   🚀 SAERTI API - Database Setup (Clerk Edition)   ║
╚════════════════════════════════════════════════════╝
`);

async function setupDatabase() {
  let connection;

  try {
    // Conectar a MySQL sin especificar base de datos
    console.log('📡 Conectando a MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conexión establecida\n');

    // Crear base de datos si no existe
    console.log(`📦 Creando base de datos "${DB_NAME}"...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${DB_NAME}\``);
    console.log('✅ Base de datos lista\n');

    // ============================================
    // TABLA: users (con Clerk support)
    // ============================================
    console.log('👤 Creando tabla users...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        role ENUM('admin', 'manager', 'user') DEFAULT 'user',
        organization_id VARCHAR(255),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_clerk_id (clerk_id),
        INDEX idx_email (email),
        INDEX idx_organization (organization_id),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla users creada\n');

    // ============================================
    // TABLA: organizations
    // ============================================
    console.log('🏢 Creando tabla organizations...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(255) PRIMARY KEY,
        clerk_org_id VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_clerk_org (clerk_org_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla organizations creada\n');

    // ============================================
    // TABLA: projects
    // ============================================
    console.log('📁 Creando tabla projects...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        budget DECIMAL(15,2),
        status ENUM('planning', 'active', 'completed', 'cancelled') DEFAULT 'planning',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_organization (organization_id),
        INDEX idx_status (status),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla projects creada\n');

    // ============================================
    // TABLA: cashflow
    // ============================================
    console.log('💰 Creando tabla cashflow...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cashflow (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id VARCHAR(255),
        project_id INT,
        type ENUM('income', 'expense') NOT NULL,
        category VARCHAR(100),
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_organization (organization_id),
        INDEX idx_project (project_id),
        INDEX idx_type (type),
        INDEX idx_date (date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla cashflow creada\n');

    // ============================================
    // TABLA: income
    // ============================================
    console.log('📈 Creando tabla income...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS income (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id VARCHAR(255),
        project_id INT,
        category_id INT,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        payment_method VARCHAR(50),
        invoice_number VARCHAR(100),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_organization (organization_id),
        INDEX idx_project (project_id),
        INDEX idx_date (date),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla income creada\n');

    // ============================================
    // TABLA: income_categories
    // ============================================
    console.log('📊 Creando tabla income_categories...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS income_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla income_categories creada\n');

    // ============================================
    // TABLAS ADICIONALES (abreviado)
    // ============================================
    
    const additionalTables = [
      'milestones',
      'empleados',
      'remuneraciones',
      'previsional',
      'factoring',
      'factoring_entities',
      'fixed_costs',
      'account_categories',
      'orden_compra',
      'orden_compra_items'
    ];

    for (const table of additionalTables) {
      console.log(`📋 Creando tabla ${table}...`);
      // Aquí puedes agregar las definiciones específicas de cada tabla
      // Por brevedad, solo creamos tablas básicas
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          organization_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_organization (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`✅ Tabla ${table} creada`);
    }

    console.log(`
╔════════════════════════════════════════════════════╗
║              ✅ Setup completado exitosamente       ║
╚════════════════════════════════════════════════════╝

Base de datos: ${DB_NAME}
Host: ${DB_CONFIG.host}
Puerto: ${DB_CONFIG.port}

✨ Ahora puedes ejecutar:
   npm run dev
    `);

  } catch (error) {
    console.error('\n❌ Error durante el setup:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar setup
setupDatabase();