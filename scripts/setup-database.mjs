// scripts/setup-unified.mjs
// Ejecutar: node scripts/setup-unified.mjs --force --yes

import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
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

console.log(`
╔════════════════════════════════════════════════════╗
║   🚀 SAERTI API - Setup Unificado (Clerk + Full)   ║
╚════════════════════════════════════════════════════╝
`);

// ==========================================
// UTILIDADES
// ==========================================
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

async function checkTableExists(tableName) {
  try {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [DB_CONFIG.database, tableName]
    );
    return rows.length > 0;
  } catch (error) {
    return false;
  }
}

// ==========================================
// TABLA: USERS (con Clerk + multi-tenant)
// ==========================================
async function createUsersTable() {
  const exists = await checkTableExists('users');
  if (exists) {
    console.log('ℹ️ Tabla users ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      clerk_id VARCHAR(255) UNIQUE COMMENT 'Clerk user ID',
      email VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      password VARCHAR(100) COMMENT 'Solo para usuarios sin Clerk',
      role ENUM('admin', 'manager', 'user') DEFAULT 'user',
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      position VARCHAR(100) DEFAULT NULL,
      location VARCHAR(200) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      emergency_phone VARCHAR(20) DEFAULT NULL,
      default_cost_center_id BIGINT UNSIGNED DEFAULT NULL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_clerk_id (clerk_id),
      INDEX idx_email (email),
      INDEX idx_organization (organization_id),
      INDEX idx_role (role),
      INDEX idx_default_cost_center (default_cost_center_id)
    )
  `);
  console.log('✅ Tabla users creada (Clerk + multi-tenant)');
}

// ==========================================
// TABLA: COST_CENTERS (multi-tenant)
// ==========================================
async function createCostCentersTable() {
  const exists = await checkTableExists('cost_centers');
  if (exists) {
    console.log('ℹ️ Tabla cost_centers ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COMMENT 'Clerk organization ID',
      code VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type ENUM('proyecto', 'administrativo', 'operacional', 'mantenimiento') DEFAULT 'proyecto',
      description TEXT,
      owner_id BIGINT UNSIGNED NULL,
      client VARCHAR(255) NULL,
      client_id BIGINT UNSIGNED NULL,
      status ENUM('borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado') DEFAULT 'borrador',
      start_date DATE NULL,
      expected_end_date DATE NULL,
      actual_end_date DATE NULL,
      total_budget DECIMAL(15,2) NULL,
      currency_id INT UNSIGNED DEFAULT 1,
      location VARCHAR(255) NULL,
      location_lat DOUBLE NULL,
      location_lon DOUBLE NULL,
      address TEXT NULL,
      department VARCHAR(100) NULL,
      manager_id BIGINT UNSIGNED NULL,
      budget_period ENUM('mensual', 'trimestral', 'anual') NULL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_organization (organization_id),
      INDEX idx_code (code),
      INDEX idx_type (type),
      INDEX idx_status (status),
      INDEX idx_owner (owner_id),
      INDEX idx_client (client_id),
      INDEX idx_manager (manager_id),
      INDEX idx_active (active),
      UNIQUE KEY unique_org_code (organization_id, code)
    )
  `);
  console.log('✅ Tabla cost_centers creada (multi-tenant)');
}

// ==========================================
// TABLA: CLIENTS (multi-tenant)
// ==========================================
async function createClientsTable() {
  const exists = await checkTableExists('clients');
  if (exists) {
    console.log('ℹ️ Tabla clients ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255),
      tax_id VARCHAR(20) NOT NULL,
      legal_name VARCHAR(255) NOT NULL,
      commercial_name VARCHAR(255),
      address TEXT,
      phone VARCHAR(50),
      email VARCHAR(100),
      contact_person VARCHAR(100),
      contact_phone VARCHAR(50),
      contact_email VARCHAR(100),
      client_type ENUM('publico', 'privado', 'mixto') DEFAULT 'privado',
      industry VARCHAR(100),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_organization (organization_id),
      INDEX idx_tax_id (tax_id),
      INDEX idx_legal_name (legal_name),
      UNIQUE KEY unique_org_tax_id (organization_id, tax_id)
    )
  `);
  console.log('✅ Tabla clients creada (multi-tenant)');
}

// ==========================================
// FOREIGN KEYS CRUZADAS
// ==========================================
async function addCrossTableForeignKeys() {
  try {
    await conn.query(`
      ALTER TABLE users 
      ADD CONSTRAINT fk_user_cost_center 
      FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
    `);
    console.log('✅ FK: users.default_cost_center_id → cost_centers.id');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.error('⚠️ Error añadiendo FK users:', error.message);
    }
  }

  try {
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_owner 
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✅ FK: cost_centers.owner_id → users.id');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.error('⚠️ Error añadiendo FK cost_centers.owner:', error.message);
    }
  }

  try {
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_client 
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    `);
    console.log('✅ FK: cost_centers.client_id → clients.id');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.error('⚠️ Error añadiendo FK cost_centers.client:', error.message);
    }
  }

  try {
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_manager 
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✅ FK: cost_centers.manager_id → users.id');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') {
      console.error('⚠️ Error añadiendo FK cost_centers.manager:', error.message);
    }
  }
}


// ==========================================
// TABLA: ACCOUNT_CATEGORIES (compartida)
// ==========================================
async function createAccountCategoriesTable() {
  const exists = await checkTableExists('account_categories');
  if (exists) {
    console.log('ℹ️ Tabla account_categories ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS account_categories (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      type ENUM('mano_obra', 'maquinaria', 'materiales', 'combustibles', 'gastos_generales') DEFAULT 'gastos_generales',
      group_name VARCHAR(100),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_code (code),
      INDEX idx_type (type),
      INDEX idx_group (group_name)
    )
  `);
  console.log('✅ Tabla account_categories creada (42 categorías)');
}

// ==========================================
// TABLA: SUPPLIERS (multi-tenant)
// ==========================================
async function createSuppliersTable() {
  const exists = await checkTableExists('suppliers');
  if (exists) {
    console.log('ℹ️ Tabla suppliers ya existe');
    return;
  }

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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_organization (organization_id),
      INDEX idx_tax_id (tax_id),
      INDEX idx_legal_name (legal_name),
      UNIQUE KEY unique_org_tax_id (organization_id, tax_id)
    )
  `);
  console.log('✅ Tabla suppliers creada (multi-tenant)');
}





// ==========================================
// TABLA: ACCOUNTING_COSTS (multi-tenant + evolución)
// ==========================================
async function createAccountingCostsTable() {
  const exists = await checkTableExists('accounting_costs');
  if (exists) {
    console.log('ℹ️ Tabla accounting_costs ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS accounting_costs (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      cost_center_id BIGINT UNSIGNED NOT NULL,
      account_category_id BIGINT UNSIGNED NOT NULL,
      transaction_type ENUM('ingreso', 'gasto') NOT NULL DEFAULT 'gasto',
      cost_type ENUM('real', 'presupuestado', 'estimado') DEFAULT 'real',
      description VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      date DATE NOT NULL,
      period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
      period_year INT NOT NULL,
      period_month INT NOT NULL,
      invoice_id BIGINT UNSIGNED NULL,
      supplier_id BIGINT UNSIGNED NULL,
      notes TEXT COLLATE utf8mb4_unicode_ci,
      reference_document VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL,
      tags JSON NULL,
      metadata JSON NULL,
      status ENUM('borrador', 'confirmado', 'cancelado') DEFAULT 'confirmado',
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
      FOREIGN KEY (account_category_id) REFERENCES account_categories(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_organization (organization_id),
      INDEX idx_cost_center (cost_center_id),
      INDEX idx_account_category (account_category_id),
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_period_year_month (period_year, period_month),
      INDEX idx_multidim_navigation (cost_center_id, account_category_id, transaction_type, period_year, period_month)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla accounting_costs creada (multi-tenant + evolución)');
}

// ==========================================
// SISTEMA DINÁMICO DE INGRESOS (4 TABLAS)
// ==========================================
// Este archivo contiene las funciones para crear las tablas del sistema dinámico de ingresos
// Se agregará al archivo setup-unified.mjs

// TABLA 1: income_types - Configuración de tipos de ingresos
async function createIncomeTypesTable() {
  const exists = await checkTableExists('income_types');
  if (exists) {
    console.log('ℹ️ Tabla income_types ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS income_types (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      -- Información básica
      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      icon VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'dollar-sign',
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#3B82F6',

      -- Campos base (siempre visibles)
      -- name, description, notes, date, status_id, cost_center_id son base

      -- Control de visibilidad de campos opcionales (show_*)
      show_amount BOOLEAN DEFAULT TRUE,
      show_category BOOLEAN DEFAULT TRUE,
      show_payment_date BOOLEAN DEFAULT FALSE,
      show_reference_number BOOLEAN DEFAULT FALSE,

      show_payment_method BOOLEAN DEFAULT FALSE,
      show_payment_status BOOLEAN DEFAULT TRUE,
      show_currency BOOLEAN DEFAULT FALSE,
      show_exchange_rate BOOLEAN DEFAULT FALSE,
      show_invoice_number BOOLEAN DEFAULT FALSE,

      -- Control de campos requeridos (required_*)
      required_name BOOLEAN DEFAULT TRUE,
      required_date BOOLEAN DEFAULT TRUE,
      required_status BOOLEAN DEFAULT TRUE,
      required_cost_center BOOLEAN DEFAULT TRUE,
      required_amount BOOLEAN DEFAULT FALSE,
      required_category BOOLEAN DEFAULT FALSE,
      required_payment_date BOOLEAN DEFAULT FALSE,
      required_reference_number BOOLEAN DEFAULT FALSE,

      required_payment_method BOOLEAN DEFAULT FALSE,
      required_payment_status BOOLEAN DEFAULT FALSE,
      required_currency BOOLEAN DEFAULT FALSE,
      required_exchange_rate BOOLEAN DEFAULT FALSE,
      required_invoice_number BOOLEAN DEFAULT FALSE,

      -- Metadata
      is_active BOOLEAN DEFAULT TRUE,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      UNIQUE KEY unique_org_name (organization_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla income_types creada (sistema dinámico)');
}

// TABLA 2: income_categories - Categorías específicas por tipo
async function createIncomeCategoriesTableNew() {
  const exists = await checkTableExists('income_categories');
  if (exists) {
    console.log('ℹ️ Tabla income_categories ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS income_categories (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      income_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#6B7280',

      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (income_type_id) REFERENCES income_types(id) ON DELETE CASCADE,

      INDEX idx_income_type (income_type_id),
      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      UNIQUE KEY unique_type_name (income_type_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla income_categories creada (por tipo)');
}

// TABLA 3: income_statuses - Estados específicos por tipo
async function createIncomeStatusesTable() {
  const exists = await checkTableExists('income_statuses');
  if (exists) {
    console.log('ℹ️ Tabla income_statuses ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS income_statuses (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      income_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#6B7280',
      is_final BOOLEAN DEFAULT FALSE COMMENT 'Indica si es un estado final (ej: pagado, cancelado)',

      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (income_type_id) REFERENCES income_types(id) ON DELETE CASCADE,

      INDEX idx_income_type (income_type_id),
      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      INDEX idx_final (is_final),
      UNIQUE KEY unique_type_name (income_type_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla income_statuses creada (por tipo)');
}

// TABLA 4: incomes_data - Datos unificados con todas las columnas posibles
async function createIncomesDataTable() {
  const exists = await checkTableExists('incomes_data');
  if (exists) {
    console.log('ℹ️ Tabla incomes_data ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS incomes_data (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      income_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      -- Campos base (siempre presentes, configurables como requeridos)
      name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      description TEXT COLLATE utf8mb4_unicode_ci,
      notes TEXT COLLATE utf8mb4_unicode_ci,
      date DATE,
      status_id BIGINT UNSIGNED,
      cost_center_id BIGINT UNSIGNED,

      -- Campos opcionales (usados solo si show_* = true en income_type)
      amount DECIMAL(15,2) DEFAULT NULL,
      tax_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto de impuestos/IVA',
      net_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto neto sin impuestos',
      total_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto total con impuestos',
      category_id BIGINT UNSIGNED DEFAULT NULL,
      payment_date DATE DEFAULT NULL,
      reference_number VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

      payment_method ENUM('transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro') DEFAULT NULL,
      payment_status ENUM('pendiente', 'parcial', 'pagado', 'anulado') DEFAULT NULL,
      currency VARCHAR(10) COLLATE utf8mb4_unicode_ci DEFAULT 'CLP',
      exchange_rate DECIMAL(10,4) DEFAULT NULL,
      invoice_number VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

      -- Metadata
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (income_type_id) REFERENCES income_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (status_id) REFERENCES income_statuses(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES income_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_organization (organization_id),
      INDEX idx_income_type (income_type_id),
      INDEX idx_date (date),
      INDEX idx_status (status_id),
      INDEX idx_cost_center (cost_center_id),
      INDEX idx_category (category_id),
      INDEX idx_payment_status (payment_status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla incomes_data creada (datos unificados)');
}

// ==========================================
// SISTEMA DINÁMICO DE EGRESOS (4 TABLAS)
// ==========================================

// TABLA 1: expense_types - Configuración de tipos de egresos
async function createExpenseTypesTable() {
  const exists = await checkTableExists('expense_types');
  if (exists) {
    console.log('ℹ️ Tabla expense_types ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS expense_types (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      -- Información básica
      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      icon VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'dollar-sign',
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#EF4444',

      -- Campos base (siempre visibles)
      -- name, description, notes, date, status_id, cost_center_id son base

      -- Control de visibilidad de campos opcionales (show_*)
      show_amount BOOLEAN DEFAULT TRUE,
      show_category BOOLEAN DEFAULT TRUE,
      show_payment_date BOOLEAN DEFAULT FALSE,
      show_reference_number BOOLEAN DEFAULT FALSE,

      show_payment_method BOOLEAN DEFAULT FALSE,
      show_payment_status BOOLEAN DEFAULT TRUE,
      show_currency BOOLEAN DEFAULT FALSE,
      show_exchange_rate BOOLEAN DEFAULT FALSE,
      show_invoice_number BOOLEAN DEFAULT FALSE,

      -- Control de campos requeridos (required_*)
      required_name BOOLEAN DEFAULT TRUE,
      required_date BOOLEAN DEFAULT TRUE,
      required_status BOOLEAN DEFAULT TRUE,
      required_cost_center BOOLEAN DEFAULT TRUE,
      required_amount BOOLEAN DEFAULT FALSE,
      required_category BOOLEAN DEFAULT FALSE,
      required_payment_date BOOLEAN DEFAULT FALSE,
      required_reference_number BOOLEAN DEFAULT FALSE,

      required_payment_method BOOLEAN DEFAULT FALSE,
      required_payment_status BOOLEAN DEFAULT FALSE,
      required_currency BOOLEAN DEFAULT FALSE,
      required_exchange_rate BOOLEAN DEFAULT FALSE,
      required_invoice_number BOOLEAN DEFAULT FALSE,

      -- Metadata
      is_active BOOLEAN DEFAULT TRUE,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      UNIQUE KEY unique_org_name (organization_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla expense_types creada (sistema dinámico)');
}

// TABLA 2: expense_categories - Categorías específicas por tipo
async function createExpenseCategoriesTable() {
  const exists = await checkTableExists('expense_categories');
  if (exists) {
    console.log('ℹ️ Tabla expense_categories ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      expense_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#6B7280',

      is_active BOOLEAN DEFAULT TRUE,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (expense_type_id) REFERENCES expense_types(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_expense_type (expense_type_id),
      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      UNIQUE KEY unique_type_name (expense_type_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla expense_categories creada (por tipo)');
}

// TABLA 3: expense_statuses - Estados específicos por tipo
async function createExpenseStatusesTable() {
  const exists = await checkTableExists('expense_statuses');
  if (exists) {
    console.log('ℹ️ Tabla expense_statuses ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS expense_statuses (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      expense_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      color VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT '#6B7280',
      is_final BOOLEAN DEFAULT FALSE COMMENT 'Indica si es un estado final (ej: pagado, cancelado)',

      is_active BOOLEAN DEFAULT TRUE,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (expense_type_id) REFERENCES expense_types(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_expense_type (expense_type_id),
      INDEX idx_organization (organization_id),
      INDEX idx_active (is_active),
      INDEX idx_final (is_final),
      UNIQUE KEY unique_type_name (expense_type_id, name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla expense_statuses creada (por tipo)');
}

// TABLA 4: expenses_data - Datos unificados con todas las columnas posibles
async function createExpensesDataTable() {
  const exists = await checkTableExists('expenses_data');
  if (exists) {
    console.log('ℹ️ Tabla expenses_data ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS expenses_data (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      expense_type_id BIGINT UNSIGNED NOT NULL,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,

      -- Campos base (siempre presentes, configurables como requeridos)
      name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      description TEXT COLLATE utf8mb4_unicode_ci,
      notes TEXT COLLATE utf8mb4_unicode_ci,
      date DATE,
      status_id BIGINT UNSIGNED,
      cost_center_id BIGINT UNSIGNED,

      -- Campos opcionales (usados solo si show_* = true en expense_type)
      amount DECIMAL(15,2) DEFAULT NULL,
      tax_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto de impuestos/IVA',
      net_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto neto sin impuestos',
      total_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto total con impuestos',
      category_id BIGINT UNSIGNED DEFAULT NULL,
      payment_date DATE DEFAULT NULL,
      reference_number VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

      payment_method ENUM('transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro') DEFAULT NULL,
      payment_status ENUM('pendiente', 'parcial', 'pagado', 'anulado') DEFAULT NULL,
      currency VARCHAR(10) COLLATE utf8mb4_unicode_ci DEFAULT 'CLP',
      exchange_rate DECIMAL(10,4) DEFAULT NULL,
      invoice_number VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

      -- Metadata
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (expense_type_id) REFERENCES expense_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (status_id) REFERENCES expense_statuses(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

      INDEX idx_organization (organization_id),
      INDEX idx_expense_type (expense_type_id),
      INDEX idx_date (date),
      INDEX idx_status (status_id),
      INDEX idx_cost_center (cost_center_id),
      INDEX idx_category (category_id),
      INDEX idx_payment_status (payment_status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla expenses_data creada (datos unificados)');
}

// ==========================================
// TABLA: PROJECTS (multi-tenant)
// ==========================================
async function createProjectsTable() {
  const exists = await checkTableExists('projects');
  if (exists) {
    console.log('ℹ️ Tabla projects ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      
      -- Información básica
      code VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
      name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci,
      
      -- Cliente
      client_name VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      client_id BIGINT UNSIGNED,
      
      -- Fechas
      start_date DATE,
      expected_end_date DATE,
      actual_end_date DATE,
      
      -- Financiero
      total_budget DECIMAL(15,2) DEFAULT 0,
      currency VARCHAR(10) COLLATE utf8mb4_unicode_ci DEFAULT 'CLP',
      
      -- Ubicación
      location VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      
      -- Estado
      status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
      
      -- Responsables
      project_manager_id BIGINT UNSIGNED,
      
      -- Relación con cost_center
      cost_center_id BIGINT UNSIGNED,
      
      -- Control
      active BOOLEAN DEFAULT TRUE,
      created_by BIGINT UNSIGNED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign Keys
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      
      -- Indexes
      INDEX idx_organization (organization_id),
      INDEX idx_code (code),
      INDEX idx_status (status),
      INDEX idx_client (client_id),
      INDEX idx_cost_center (cost_center_id),
      INDEX idx_active (active),
      UNIQUE KEY unique_org_code (organization_id, code)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla projects creada (multi-tenant)');
}

async function createBudgetAnalysesTable() {
  const exists = await checkTableExists('budget_analyses');
  if (exists) {
    console.log('ℹ️ Tabla budget_analyses ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS budget_analyses (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      
      -- Identificación única y tenant
      analysis_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'ID único del análisis',
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci COMMENT 'Clerk organization ID',
      user_id BIGINT UNSIGNED NOT NULL COMMENT 'Usuario que realizó el análisis',
      clerk_user_id VARCHAR(255) COLLATE utf8mb4_unicode_ci COMMENT 'Clerk user ID',
      
      -- Tipo de análisis
      analysis_type ENUM('quick', 'pdf', 'project') NOT NULL DEFAULT 'quick',
      
      -- Información del archivo (para análisis PDF)
      file_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      file_size INT UNSIGNED DEFAULT NULL COMMENT 'Tamaño en bytes',
      
      -- Datos del proyecto analizado
      project_type VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Proyecto General',
      location VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Chile',
      area_m2 DECIMAL(10,2) DEFAULT NULL,
      
      -- Resultados del análisis
      estimated_budget DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Presupuesto estimado en CLP',
      confidence_score INT UNSIGNED DEFAULT 75 COMMENT 'Score de confianza 0-100',
      
      -- Resumen corto (para listados)
      summary TEXT COLLATE utf8mb4_unicode_ci,
      
      -- Análisis completo (JSON)
      full_analysis JSON NOT NULL COMMENT 'Análisis completo en formato JSON',
      
      -- Datos del proyecto original (JSON)
      project_data JSON DEFAULT NULL,
      
      -- Metadatos del análisis (JSON)
      metadata JSON DEFAULT NULL COMMENT 'analysis_depth, api_cost, processing_time, etc',
      
      -- Relación con proyecto (opcional)
      project_id BIGINT UNSIGNED DEFAULT NULL,
      cost_center_id BIGINT UNSIGNED DEFAULT NULL,
      
      -- Control
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign Keys
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      
      -- Índices para búsquedas rápidas
      INDEX idx_analysis_id (analysis_id),
      INDEX idx_organization (organization_id),
      INDEX idx_user (user_id),
      INDEX idx_clerk_user (clerk_user_id),
      INDEX idx_analysis_type (analysis_type),
      INDEX idx_created_at (created_at DESC),
      INDEX idx_user_created (user_id, created_at DESC),
      INDEX idx_org_created (organization_id, created_at DESC),
      INDEX idx_project (project_id),
      INDEX idx_cost_center (cost_center_id),
      
      -- Índice compuesto para historial de usuario
      INDEX idx_user_history (user_id, analysis_type, created_at DESC)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Historial de análisis del Budget Analyzer'
  `);
  console.log('✅ Tabla budget_analyses creada (multi-tenant)');
}

// ==========================================
// TABLA: ORGANIZATION_INVITATIONS
// ==========================================
async function createOrganizationInvitationsTable() {
  const exists = await checkTableExists('organization_invitations');
  if (exists) {
    console.log('ℹ️ Tabla organization_invitations ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS organization_invitations (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

      -- Organización y destinatario
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Clerk organization ID',
      email VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
      role ENUM('admin', 'manager', 'user') DEFAULT 'admin' COMMENT 'Rol asignado al aceptar',

      -- Usuario que invitó
      invited_by BIGINT UNSIGNED COMMENT 'Usuario que envió la invitación',

      -- Estado y token
      status ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending',
      token VARCHAR(255) UNIQUE NOT NULL COMMENT 'Token único para aceptar/rechazar',

      -- Fechas
      expires_at TIMESTAMP NOT NULL COMMENT 'Fecha de expiración (24 horas)',
      accepted_at TIMESTAMP NULL COMMENT 'Fecha de aceptación',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      -- Foreign Keys
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,

      -- Índices
      INDEX idx_organization (organization_id),
      INDEX idx_email (email),
      INDEX idx_token (token),
      INDEX idx_status (status),
      INDEX idx_expires (expires_at),
      INDEX idx_org_status (organization_id, status),
      INDEX idx_email_status (email, status)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Invitaciones a organizaciones con tokens de un solo uso'
  `);
  console.log('✅ Tabla organization_invitations creada (sistema de invitaciones)');
}

// ==========================================
// VISTA: MULTIDIMENSIONAL_COSTS_VIEW
// ==========================================
async function createMultidimensionalView() {
  try {
    console.log('🔄 Creando vista multidimensional_costs_view...');
    
    await conn.query('DROP VIEW IF EXISTS multidimensional_costs_view');

    // Asegurar que todas las columnas usen utf8mb4_unicode_ci
    await conn.query(`
      CREATE VIEW multidimensional_costs_view AS
      SELECT
        ac.id as cost_id,
        CAST(ac.organization_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as organization_id,
        ac.transaction_type,
        ac.cost_type,
        ac.amount,
        CAST(ac.description AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as description,
        ac.date,
        ac.period_year,
        ac.period_month,
        CAST(ac.status AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as status,
        cc.id as cost_center_id,
        CAST(cc.code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_code,
        CAST(cc.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_name,
        CAST(cc.type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_type,
        CAST(cc.client AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_client,
        CAST(cc.status AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_status,
        cat.id as category_id,
        CAST(cat.code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as category_code,
        CAST(cat.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as category_name,
        CAST(cat.type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as category_type,
        CAST(cat.group_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as category_group,
        s.id as supplier_id,
        CAST(s.tax_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as supplier_tax_id,
        CAST(s.legal_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as supplier_name,
        CAST(s.commercial_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as supplier_commercial_name,
        CAST(CASE
          WHEN ac.invoice_id IS NOT NULL THEN 'factura'
          ELSE 'manual'
        END AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as source_type,
        COALESCE(ac.invoice_id, ac.id) as source_id,
        CAST(CONCAT(ac.period_year, '-', LPAD(ac.period_month, 2, '0')) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as period_key,
        CAST(CONCAT(cc.type, ': ', cc.name) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as cost_center_display,
        CAST(CONCAT(cat.group_name, ': ', cat.name) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as category_display,
        CAST(ac.notes AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as notes,
        CAST(ac.reference_document AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci as reference_document,
        ac.created_at,
        ac.updated_at
      FROM accounting_costs ac
      LEFT JOIN cost_centers cc ON ac.cost_center_id = cc.id
      LEFT JOIN account_categories cat ON ac.account_category_id = cat.id
      LEFT JOIN suppliers s ON ac.supplier_id = s.id
      WHERE ac.status = 'confirmado'
      ORDER BY date DESC, created_at DESC
    `);
    
    console.log('✅ Vista multidimensional_costs_view creada');
    console.log('🎯 Incluye: accounting_costs');
    
  } catch (error) {
    console.error('❌ Error creando vista multidimensional:', error);
    throw error;
  }
}

async function createUserServiceSubscriptionsTable() {
  const exists = await checkTableExists('user_service_subscriptions');
  if (exists) {
    console.log('ℹ️ Tabla user_service_subscriptions ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_service_subscriptions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      
      -- Usuario y servicio
      user_id BIGINT UNSIGNED NOT NULL,
      clerk_user_id VARCHAR(255) COLLATE utf8mb4_unicode_ci COMMENT 'Clerk user ID',
      service VARCHAR(50) NOT NULL COMMENT 'budget-analyzer o cash-flow',
      tier VARCHAR(50) NOT NULL DEFAULT 'free' COMMENT 'free, starter, professional, enterprise',
      
      -- Estado de suscripción
      active BOOLEAN DEFAULT TRUE,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL COMMENT 'Null = no expira',
      payment_status ENUM('trial', 'active', 'cancelled', 'expired') DEFAULT 'trial',
      
      -- Metadata de pago (para integración futura)
      stripe_subscription_id VARCHAR(255) NULL,
      stripe_customer_id VARCHAR(255) NULL,
      flow_order_id VARCHAR(255) NULL,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign Keys
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      
      -- Indexes
      INDEX idx_user_service (user_id, service),
      INDEX idx_clerk_user (clerk_user_id),
      INDEX idx_active (active),
      INDEX idx_tier (tier),
      INDEX idx_expires (expires_at),
      UNIQUE KEY unique_user_service_active (user_id, service, active)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Suscripciones de usuarios a servicios'
  `);
  console.log('✅ Tabla user_service_subscriptions creada');
}

// TABLA: USER_SERVICE_METRICS
async function createUserServiceMetricsTable() {
  const exists = await checkTableExists('user_service_metrics');
  if (exists) {
    console.log('ℹ️ Tabla user_service_metrics ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_service_metrics (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      
      -- Usuario y servicio
      user_id BIGINT UNSIGNED NOT NULL,
      service VARCHAR(50) NOT NULL COMMENT 'budget-analyzer o cash-flow',
      metric_name VARCHAR(100) NOT NULL COMMENT 'daily_analyses, transactions, etc',
      metric_value INT DEFAULT 0 COMMENT 'Valor actual de la métrica',
      
      -- Período de la métrica
      period VARCHAR(50) NOT NULL COMMENT 'YYYY-MM-DD (daily), YYYY-MM (monthly), permanent',
      
      -- Control de reset
      last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      -- Timestamps
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Foreign Keys
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      
      -- Indexes
      INDEX idx_user_service_metric (user_id, service, metric_name),
      INDEX idx_period (period),
      INDEX idx_updated (updated_at),
      INDEX idx_user_period (user_id, period),
      UNIQUE KEY unique_user_service_metric_period (user_id, service, metric_name, period)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Métricas de uso por usuario y servicio'
  `);
  console.log('✅ Tabla user_service_metrics creada');
}

// TABLA: USAGE_HISTORY
async function createUsageHistoryTable() {
  const exists = await checkTableExists('usage_history');
  if (exists) {
    console.log('ℹ️ Tabla usage_history ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS usage_history (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      
      -- Usuario y servicio
      user_id BIGINT UNSIGNED NOT NULL,
      service VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL COMMENT 'analysis_created, transaction_created, etc',
      
      -- Metadata del evento (JSON)
      metadata JSON NULL COMMENT 'Datos adicionales del evento',
      
      -- Tracking
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      
      -- Timestamp
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      -- Foreign Keys
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      
      -- Indexes
      INDEX idx_user_service (user_id, service),
      INDEX idx_action (action),
      INDEX idx_created (created_at),
      INDEX idx_user_created (user_id, created_at DESC)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Historial de acciones para analytics'
  `);
  console.log('✅ Tabla usage_history creada');
}

// TABLA: SERVICE_FEATURES
async function createServiceFeaturesTable() {
  const exists = await checkTableExists('service_features');
  if (exists) {
    console.log('ℹ️ Tabla service_features ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_features (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      
      -- Servicio y tier
      service VARCHAR(50) NOT NULL,
      tier VARCHAR(50) NOT NULL,
      feature_name VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      
      -- Configuración específica (JSON)
      config JSON NULL COMMENT 'Configuración específica de la feature',
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes
      INDEX idx_service_tier (service, tier),
      INDEX idx_feature (feature_name),
      UNIQUE KEY unique_service_tier_feature (service, tier, feature_name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    COMMENT 'Features disponibles por servicio y tier'
  `);
  console.log('✅ Tabla service_features creada');
}

// INSERTAR FEATURES POR DEFECTO
async function insertDefaultServiceFeatures() {
  try {
    const [existing] = await conn.query('SELECT COUNT(*) as count FROM service_features');
    if (existing[0].count > 0) {
      console.log('ℹ️ Service features ya existen');
      return;
    }

    // Features para Budget Analyzer
    await conn.query(`
      INSERT INTO service_features (service, tier, feature_name, enabled, config) VALUES
      -- FREE
      ('budget-analyzer', 'free', 'basic_analysis', TRUE, NULL),
      ('budget-analyzer', 'free', 'pdf_upload', TRUE, '{"max_file_size_mb": 10}'),
      
      -- PRO
      ('budget-analyzer', 'pro', 'basic_analysis', TRUE, NULL),
      ('budget-analyzer', 'pro', 'pdf_upload', TRUE, '{"max_file_size_mb": 50}'),
      ('budget-analyzer', 'pro', 'comparisons', TRUE, NULL),
      ('budget-analyzer', 'pro', 'advanced_insights', TRUE, NULL),
      
      -- ENTERPRISE
      ('budget-analyzer', 'enterprise', 'all', TRUE, NULL)
    `);

    // Features para Cash Flow
    await conn.query(`
      INSERT INTO service_features (service, tier, feature_name, enabled, config) VALUES
      -- FREE
      ('cash-flow', 'free', 'basic_cashflow', TRUE, NULL),
      ('cash-flow', 'free', 'manual_entry', TRUE, NULL),
      ('cash-flow', 'free', 'basic_reports', TRUE, NULL),
      
      -- STARTER
      ('cash-flow', 'starter', 'basic_cashflow', TRUE, NULL),
      ('cash-flow', 'starter', 'manual_entry', TRUE, NULL),
      ('cash-flow', 'starter', 'basic_reports', TRUE, NULL),
      ('cash-flow', 'starter', 'excel_export', TRUE, NULL),
      ('cash-flow', 'starter', 'basic_projections', TRUE, NULL),
      
      -- PROFESSIONAL
      ('cash-flow', 'professional', 'basic_cashflow', TRUE, NULL),
      ('cash-flow', 'professional', 'manual_entry', TRUE, NULL),
      ('cash-flow', 'professional', 'basic_reports', TRUE, NULL),
      ('cash-flow', 'professional', 'excel_export', TRUE, NULL),
      ('cash-flow', 'professional', 'pdf_export', TRUE, NULL),
      ('cash-flow', 'professional', 'advanced_projections', TRUE, NULL),
      ('cash-flow', 'professional', 'ai_insights', TRUE, NULL),
      ('cash-flow', 'professional', 'multi_currency', TRUE, NULL),
      ('cash-flow', 'professional', 'api_access', TRUE, NULL),
      
      -- ENTERPRISE
      ('cash-flow', 'enterprise', 'all', TRUE, NULL)
    `);

    console.log('✅ Service features insertadas');
  } catch (error) {
    console.error('❌ Error insertando service features:', error);
    throw error;
  }
}

// VISTAS PARA ANALYTICS
async function createMetricsViews() {
  try {
    await conn.query(`DROP VIEW IF EXISTS v_usage_summary`);
    await conn.query(`
      CREATE VIEW v_usage_summary AS
      SELECT 
        service,
        COUNT(DISTINCT user_id) as total_users,
        tier,
        COUNT(*) as subscription_count,
        SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_subscriptions
      FROM user_service_subscriptions
      GROUP BY service, tier
    `);
    console.log('✅ Vista v_usage_summary creada');

    await conn.query(`DROP VIEW IF EXISTS v_current_user_metrics`);
    await conn.query(`
      CREATE VIEW v_current_user_metrics AS
      SELECT 
        um.user_id,
        um.service,
        us.tier,
        um.metric_name,
        um.metric_value,
        um.period,
        um.last_reset,
        um.updated_at
      FROM user_service_metrics um
      LEFT JOIN user_service_subscriptions us 
        ON um.user_id = us.user_id 
        AND um.service = us.service 
        AND us.active = TRUE
    `);
    console.log('✅ Vista v_current_user_metrics creada');

  } catch (error) {
    console.error('❌ Error creando vistas:', error);
  }
}

// PROCEDIMIENTOS ALMACENADOS
async function createMetricsProcedures() {
  try {
    await conn.query(`DROP PROCEDURE IF EXISTS cleanup_old_metrics`);
    await conn.query(`
      CREATE PROCEDURE cleanup_old_metrics(IN days_to_keep INT)
      BEGIN
        DELETE FROM user_service_metrics
        WHERE updated_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY)
          AND period NOT IN ('permanent');
          
        DELETE FROM usage_history
        WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
        
        SELECT ROW_COUNT() as rows_deleted;
      END
    `);
    console.log('✅ Procedimiento cleanup_old_metrics creado');

  } catch (error) {
    console.error('❌ Error creando procedimientos:', error);
  }
}


// ==========================================
// INSERTAR DATOS INICIALES
// ==========================================
async function insertAccountCategories() {
  try {
    const [existing] = await conn.query('SELECT COUNT(*) as count FROM account_categories');
    if (existing[0].count > 0) {
      console.log('ℹ️ Account categories ya existen');
      return;
    }

    await conn.query(`
      INSERT INTO account_categories (code, name, type, group_name) VALUES
      ('1.1', 'MANO DE OBRA DIRECTO', 'mano_obra', 'Mano de Obra'),
      ('1.2', 'MANO DE OBRA INDIRECTO', 'mano_obra', 'Mano de Obra'),
      ('2.1', 'MAQUINARIA DIRECTA', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.2', 'MAQUINARIA DIRECTA MPF', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.3', 'MAQUINARIA INDIRECTA', 'maquinaria', 'Maquinaria y Equipos'),
      ('3.1', 'MOVIMIENTO DE TIERRA', 'materiales', 'Materiales'),
      ('3.2', 'MATERIALES OBRAS CIVILES', 'materiales', 'Materiales'),
      ('3.3', 'SEGURIDAD VIAL DEFINITIVA', 'materiales', 'Materiales'),
      ('4.1', 'DIÉSEL', 'combustibles', 'Combustibles'),
      ('4.2', 'BENCINA', 'combustibles', 'Combustibles'),
      ('5.1', 'ALOJAMIENTOS', 'gastos_generales', 'Gastos Generales'),
      ('5.2', 'ALIMENTACIÓN EN OBRA', 'gastos_generales', 'Gastos Generales'),
      ('5.3', 'MOVILIZACIÓN', 'gastos_generales', 'Gastos Generales'),
      ('5.4', 'SERVICIOS BÁSICOS FAENA', 'gastos_generales', 'Gastos Generales'),
      ('5.7', 'GASTOS ADMINISTRATIVOS', 'gastos_generales', 'Gastos Generales')
    `);
    console.log('✅ Account categories insertadas (15 principales)');
  } catch (error) {
    console.error('❌ Error insertando account categories:', error);
    throw error;
  }
}

async function insertDefaultCostCenter() {
  try {
    const [existing] = await conn.query(
      'SELECT COUNT(*) as count FROM cost_centers WHERE code = ?',
      ['001']
    );
    
    if (existing[0].count > 0) {
      console.log('ℹ️ Centro de costo por defecto ya existe');
      return;
    }

    await conn.query(`
      INSERT INTO cost_centers (code, name, type, description, status) VALUES
      ('001', 'Oficina Central', 'administrativo', 'Centro administrativo por defecto', 'activo')
    `);
    console.log('✅ Centro de costo por defecto creado');
  } catch (error) {
    console.error('❌ Error insertando centro de costo:', error);
    throw error;
  }
}

async function createAdminUser() {
  try {
    const [existing] = await conn.query(
      'SELECT COUNT(*) as count FROM users WHERE email = ?',
      ['admin@saer.cl']
    );
    
    if (existing[0].count > 0) {
      console.log('ℹ️ Usuario admin ya existe');
      return;
    }
    
    const hashedPassword = await bcrypt.hash('admin', 10);
    await conn.query(`
      INSERT INTO users (name, email, password, role) 
      VALUES (?, ?, ?, ?)
    `, ['Administrador', 'admin@saer.cl', hashedPassword, 'admin']);
    
    console.log('✅ Usuario admin creado:');
    console.log('   Email: admin@saer.cl');
    console.log('   Password: admin');
  } catch (error) {
    console.error('❌ Error creando usuario admin:', error);
    throw error;
  }
}

// ==========================================
// MAIN SETUP
// ==========================================

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

    console.log('\n🏗️ PASO 1: Creando tablas base...\n');
    await createUsersTable();
    await createCostCentersTable();
    await createClientsTable();

    console.log('\n🔗 PASO 2: Estableciendo relaciones cruzadas...\n');
    await addCrossTableForeignKeys();

    console.log('\n🏗️ PASO 3: Creando tablas dependientes...\n');
    await createAccountCategoriesTable();
    await createSuppliersTable();
    await createAccountingCostsTable();
    await createProjectsTable();
    await createBudgetAnalysesTable();
    await createOrganizationInvitationsTable();

    console.log('\n💰 PASO 3.5: Creando sistema dinámico de ingresos...\n');
    await createIncomeTypesTable();
    await createIncomeStatusesTable();
    await createIncomeCategoriesTableNew();
    await createIncomesDataTable();

    console.log('\n💸 PASO 3.6: Creando sistema dinámico de egresos...\n');
    await createExpenseTypesTable();
    await createExpenseStatusesTable();
    await createExpenseCategoriesTable();
    await createExpensesDataTable();

    // ✅ AGREGAR ESTO AQUÍ ✅
    console.log('\n📊 PASO 3.7: Creando sistema de métricas de uso...\n');
    await createUserServiceSubscriptionsTable();
    await createUserServiceMetricsTable();
    await createUsageHistoryTable();
    await createServiceFeaturesTable();

    console.log('\n🔄 PASO 4: Creando vista multidimensional...\n');
    await createMultidimensionalView();

    console.log('\n📝 PASO 5: Insertando datos iniciales...\n');
    await insertAccountCategories();
    await insertDefaultCostCenter();
    await createAdminUser();

    await insertDefaultServiceFeatures();
  
    console.log('\n📊 PASO 6: Creando vistas y procedimientos de métricas...\n');
    await createMetricsViews();
    await createMetricsProcedures();

    console.log('\n✅ SETUP COMPLETADO EXITOSAMENTE');
    console.log('\n🎯 Base de datos unificada lista:');
    console.log('   ✅ Soporte Clerk (clerk_id, organization_id)');
    console.log('   ✅ Multi-tenant en todas las tablas principales');
    console.log('   ✅ Vista multidimensional_costs_view funcionando');
    console.log('   ✅ 19 tablas creadas con relaciones correctas');
    console.log('   ✅ Sistema dinámico de ingresos (4 tablas)');
    console.log('   ✅ Sistema dinámico de egresos (4 tablas)');
    console.log('   ✅ Sistema de invitaciones multi-tenant');
    console.log('   ✅ Usuario admin creado (admin@saer.cl / admin)');
    console.log('   ✅ Collation uniforme (utf8mb4_unicode_ci)');
    console.log('\n🚀 Tu sistema está listo para usar!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante setup:', error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

setup();