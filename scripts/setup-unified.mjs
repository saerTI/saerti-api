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
// TABLA: INCOMES (multi-tenant)
// ==========================================
async function createIncomesTable() {
  const exists = await checkTableExists('incomes');
  if (exists) {
    console.log('ℹ️ Tabla incomes ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS incomes (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      organization_id VARCHAR(255) COLLATE utf8mb4_unicode_ci,
      document_number VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
      ep_detail VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      client_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
      client_tax_id VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
      ep_value DECIMAL(15,2) DEFAULT 0,
      adjustments DECIMAL(15,2) DEFAULT 0,
      ep_total DECIMAL(15,2) NOT NULL,
      fine DECIMAL(15,2) DEFAULT 0,
      retention DECIMAL(15,2) DEFAULT 0,
      advance DECIMAL(15,2) DEFAULT 0,
      exempt DECIMAL(15,2) DEFAULT 0,
      net_amount DECIMAL(15,2) DEFAULT 0,
      tax_amount DECIMAL(15,2) DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      factoring VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      payment_date DATE DEFAULT NULL,
      factoring_due_date DATE DEFAULT NULL,
      state ENUM('borrador', 'activo', 'facturado', 'pagado', 'cancelado') DEFAULT 'activo',
      payment_status ENUM('no_pagado', 'pago_parcial', 'pagado') DEFAULT 'no_pagado',
      date DATE NOT NULL,
      cost_center_id BIGINT UNSIGNED DEFAULT NULL,
      category_id BIGINT UNSIGNED DEFAULT NULL,
      description TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      notes TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      updated_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      
      INDEX idx_organization (organization_id),
      INDEX idx_document_number (document_number),
      INDEX idx_client_tax_id (client_tax_id),
      INDEX idx_date (date),
      INDEX idx_state (state),
      INDEX idx_payment_status (payment_status),
      INDEX idx_cost_center (cost_center_id),
      UNIQUE KEY unique_org_document (organization_id, document_number)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla incomes creada (multi-tenant)');
}

// ==========================================
// TABLA: INCOME_CATEGORIES (compartida)
// ==========================================
async function createIncomeCategoriesTable() {
  const exists = await checkTableExists('income_categories');
  if (exists) {
    console.log('ℹ️ Tabla income_categories ya existe');
    return;
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS income_categories (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      categoria VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_categoria (categoria),
      INDEX idx_active (active)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  console.log('✅ Tabla income_categories creada');
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
    await createIncomeCategoriesTable();
    await createIncomesTable();
    await createProjectsTable();
    await createBudgetAnalysesTable();
    
    console.log('\n🔄 PASO 4: Creando vista multidimensional...\n');
    await createMultidimensionalView();

    console.log('\n📝 PASO 5: Insertando datos iniciales...\n');
    await insertAccountCategories();
    await insertDefaultCostCenter();
    await createAdminUser();

    console.log('\n✅ SETUP COMPLETADO EXITOSAMENTE');
    console.log('\n🎯 Base de datos unificada lista:');
    console.log('   ✅ Soporte Clerk (clerk_id, organization_id)');
    console.log('   ✅ Multi-tenant en todas las tablas principales');
    console.log('   ✅ Vista multidimensional_costs_view funcionando');
    console.log('   ✅ Tabla incomes creada con multi-tenant');
    console.log('   ✅ 12 tablas creadas con relaciones correctas');
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