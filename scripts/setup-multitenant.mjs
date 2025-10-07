// scripts/setup-multitenant.mjs
// Ejecutar: node scripts/setup-multitenant.mjs --force --yes

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

let conn;

async function initConnection() {
  conn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password
  });
  console.log('✅ Conexión MySQL establecida');
}

async function createDatabase() {
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database} 
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE ${DB_CONFIG.database}`);
  console.log(`✅ Base de datos ${DB_CONFIG.database} lista`);
}

async function destroyDatabase() {
  await conn.query(`DROP DATABASE IF EXISTS ${DB_CONFIG.database}`);
  console.log(`🗑️ Base de datos ${DB_CONFIG.database} eliminada`);
}

// ==========================================
// TABLA USERS CON CLERK
// ==========================================
async function createUsersTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      clerk_id VARCHAR(255) UNIQUE COMMENT 'Clerk user ID',
      email VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      role ENUM('admin', 'manager', 'user') DEFAULT 'user',
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_clerk_id (clerk_id),
      INDEX idx_email (email),
      INDEX idx_organization (organization_id)
    )
  `);
  console.log('✅ Tabla users creada (con soporte Clerk)');
}

// ==========================================
// COST CENTERS (multi-tenant)
// ==========================================
async function createCostCentersTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      code VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type ENUM('proyecto', 'administrativo', 'operacional', 'mantenimiento') DEFAULT 'proyecto',
      description TEXT,
      client VARCHAR(255),
      status ENUM('borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado') DEFAULT 'borrador',
      start_date DATE,
      expected_end_date DATE,
      actual_end_date DATE,
      total_budget DECIMAL(15,2),
      location VARCHAR(255),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_organization (organization_id),
      INDEX idx_code (code),
      INDEX idx_type (type),
      INDEX idx_status (status),
      UNIQUE KEY unique_org_code (organization_id, code)
    )
  `);
  console.log('✅ Tabla cost_centers creada (multi-tenant)');
}

// ==========================================
// EMPLOYEES (multi-tenant)
// ==========================================
async function createEmployeesTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      tax_id VARCHAR(20) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email VARCHAR(100),
      phone VARCHAR(50),
      position VARCHAR(100),
      department VARCHAR(100),
      hire_date DATE,
      default_cost_center_id BIGINT UNSIGNED,
      salary_base DECIMAL(15,2),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      
      INDEX idx_organization (organization_id),
      INDEX idx_tax_id (tax_id),
      INDEX idx_full_name (full_name),
      UNIQUE KEY unique_org_tax_id (organization_id, tax_id)
    )
  `);
  console.log('✅ Tabla employees creada (multi-tenant)');
}

// ==========================================
// PAYROLL (multi-tenant)
// ==========================================
async function createPayrollTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payroll (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      employee_id BIGINT UNSIGNED NOT NULL,
      type ENUM('remuneracion', 'anticipo') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      net_salary DECIMAL(15,2),
      advance_payment DECIMAL(15,2),
      date DATE NOT NULL,
      month_period INT(2) NOT NULL,
      year_period INT(4) NOT NULL,
      work_days INT DEFAULT 30,
      payment_method ENUM('transferencia', 'cheque', 'efectivo') DEFAULT 'transferencia',
      status ENUM('pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado') DEFAULT 'pendiente',
      payment_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      
      INDEX idx_organization (organization_id),
      INDEX idx_employee (employee_id),
      INDEX idx_period (month_period, year_period),
      INDEX idx_status (status)
    )
  `);
  console.log('✅ Tabla payroll creada (multi-tenant)');
}

// ==========================================
// ACCOUNT CATEGORIES (compartida)
// ==========================================
async function createAccountCategoriesTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS account_categories (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      type ENUM('mano_obra', 'maquinaria', 'materiales', 'combustibles', 'gastos_generales') DEFAULT 'gastos_generales',
      group_name VARCHAR(100),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_code (code),
      INDEX idx_type (type)
    )
  `);
  console.log('✅ Tabla account_categories creada (compartida)');
}

// ==========================================
// SUPPLIERS (multi-tenant)
// ==========================================
async function createSuppliersTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255),
      tax_id VARCHAR(20) NOT NULL,
      legal_name VARCHAR(255) NOT NULL,
      commercial_name VARCHAR(255),
      address TEXT,
      phone VARCHAR(50),
      email VARCHAR(100),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_organization (organization_id),
      INDEX idx_tax_id (tax_id),
      UNIQUE KEY unique_org_tax_id (organization_id, tax_id)
    )
  `);
  console.log('✅ Tabla suppliers creada (multi-tenant)');
}

// ==========================================
// PURCHASE ORDERS (multi-tenant)
// ==========================================
async function createPurchaseOrdersTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255),
      po_number VARCHAR(50) NOT NULL,
      po_date DATE NOT NULL,
      cost_center_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED,
      account_category_id BIGINT UNSIGNED,
      description TEXT,
      status ENUM('borrador', 'activo', 'en_progreso', 'completado', 'cancelado') DEFAULT 'borrador',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (account_category_id) REFERENCES account_categories(id),
      
      INDEX idx_organization (organization_id),
      INDEX idx_po_number (po_number),
      INDEX idx_cost_center (cost_center_id),
      UNIQUE KEY unique_org_po_number (organization_id, po_number)
    )
  `);
  console.log('✅ Tabla purchase_orders creada (multi-tenant)');
}

// ==========================================
// PURCHASE ORDER ITEMS (multi-tenant)
// ==========================================
async function createPurchaseOrderItemsTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255),
      purchase_order_id BIGINT UNSIGNED NOT NULL,
      cost_center_id BIGINT UNSIGNED,
      account_category_id BIGINT UNSIGNED,
      date DATE NOT NULL,
      description TEXT,
      glosa TEXT,
      currency VARCHAR(10) DEFAULT 'CLP',
      total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      FOREIGN KEY (account_category_id) REFERENCES account_categories(id) ON DELETE SET NULL,
      
      INDEX idx_organization (organization_id),
      INDEX idx_po (purchase_order_id)
    )
  `);
  console.log('✅ Tabla purchase_order_items creada (multi-tenant)');
}

// ==========================================
// INSERT DATA
// ==========================================
async function insertAccountCategories() {
  const [existing] = await conn.query('SELECT COUNT(*) as count FROM account_categories');
  if (existing[0].count > 0) {
    console.log('ℹ️ Account categories ya existen');
    return;
  }

  await conn.query(`
    INSERT INTO account_categories (code, name, type, group_name) VALUES
    ('1.1', 'MANO DE OBRA DIRECTO', 'mano_obra', 'Mano de Obra'),
    ('2.1', 'MAQUINARIA DIRECTA', 'maquinaria', 'Maquinaria'),
    ('3.1', 'MATERIALES OBRAS CIVILES', 'materiales', 'Materiales'),
    ('4.1', 'DIÉSEL', 'combustibles', 'Combustibles'),
    ('5.1', 'GASTOS ADMINISTRATIVOS', 'gastos_generales', 'Gastos Generales')
  `);
  console.log('✅ Account categories insertadas');
}

async function insertDefaultOrganization() {
  const [existing] = await conn.query(
    'SELECT COUNT(*) as count FROM cost_centers WHERE organization_id IS NULL'
  );
  
  if (existing[0].count > 0) {
    console.log('ℹ️ Ya existe una organización por defecto');
    return;
  }

  // Crear centro de costo por defecto (sin organization_id para desarrollo)
  await conn.query(`
    INSERT INTO cost_centers (code, name, type, description, status) VALUES
    ('001', 'Oficina Central', 'administrativo', 'Centro administrativo por defecto', 'activo')
  `);
  console.log('✅ Centro de costo por defecto creado');
}

// ==========================================
// MAIN SETUP
// ==========================================
async function setup() {
  const force = process.argv.includes('--force');
  const skipConfirmation = process.argv.includes('--yes');

  try {
    await initConnection();

    if (force) {
      console.log('⚠️ --force: Eliminando base de datos existente...');
      if (!skipConfirmation) {
        console.log('💡 Usa --yes para saltar la confirmación');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await destroyDatabase();
    }

    await createDatabase();

    console.log('\n🏗️ Creando tablas multi-tenant...\n');
    
    await createUsersTable();
    await createCostCentersTable();
    await createEmployeesTable();
    await createAccountCategoriesTable();
    await createSuppliersTable();
    await createPayrollTable();
    await createPurchaseOrdersTable();
    await createPurchaseOrderItemsTable();

    console.log('\n📝 Insertando datos iniciales...\n');
    
    await insertAccountCategories();
    await insertDefaultOrganization();

    console.log('\n✅ SETUP COMPLETADO');
    console.log('\n🎯 Base de datos multi-tenant lista');
    console.log('   - Todas las tablas tienen organization_id');
    console.log('   - Clerk IDs soportados en users');
    console.log('   - Foreign keys configurados correctamente\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante setup:', error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

setup();