import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import config from '../src/config/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let conn;

// Initialize connection without specifying a database
async function initializeConnection() {
  console.log('Trying to connect with:', {
    host: config.db.host,
    user: config.db.user,
    passwordProvided: !!config.db.password
  });

  try {
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password
    });

    console.log('✅ MySQL server connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Error connecting to MySQL:', {
      message: error.message,
      code: error.code,
      errno: error.errno
    });
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
      console.error('\nSuggestions to resolve the issue:');
      console.error('1. Verify that the credentials in .env are correct');
      console.error('2. Try changing MySQL authentication method:');
      console.error('   ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'your_password\';');
      console.error('   FLUSH PRIVILEGES;');
    }
    return false;
  }
}

async function checkDatabaseExists() {
  const [rows] = await conn.query(
    'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
    [config.db.database]
  );
  return rows.length > 0;
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

async function destroyDatabase() {
  try {
    await conn.query(`DROP DATABASE IF EXISTS ${config.db.database}`);
    console.log(`🗑️ Database ${config.db.database} deleted successfully`);
  } catch (error) {
    console.error('⚠️ Error deleting database:', error.message);
  }
}

async function createDatabase() {
  try {
    const exists = await checkDatabaseExists();
    if (!exists) {
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database} 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ Database ${config.db.database} created`);
    } else {
      console.log(`ℹ️ Database ${config.db.database} already exists`);
    }

    await conn.query(`USE ${config.db.database}`);
  } catch (error) {
    console.error('❌ Error creating database:', error);
    throw error;
  }
}

// Create users table
async function createUsersTable() {
  try {
    const exists = await checkTableExists('users');
    if (exists) {
      console.log('ℹ️ Users table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role ENUM('admin', 'manager', 'user') DEFAULT 'user',
        position VARCHAR(100) DEFAULT NULL COMMENT 'User position or job title',
        location VARCHAR(200) DEFAULT NULL COMMENT 'General user location',
        address TEXT DEFAULT NULL COMMENT 'User address',
        emergency_phone VARCHAR(20) DEFAULT NULL COMMENT 'Emergency contact phone number',
        default_cost_center_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'User default cost center',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_cost_center (default_cost_center_id)
      )
    `);
    console.log('✅ Users table created (references cost_centers)');
  } catch (error) {
    console.error('❌ Error creating users table:', error);
    throw error;
  }
}

// MAIN TABLE: UNIFIED COST CENTERS
async function createCostCentersTable() {
  try {
    const exists = await checkTableExists('cost_centers');
    if (exists) {
      console.log('ℹ️ Cost_centers table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cost_centers (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        
        -- Basic fields (common for all types)
        code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Unique cost center code',
        name VARCHAR(255) NOT NULL COMMENT 'Cost center name',
        type ENUM('proyecto', 'administrativo', 'operacional', 'mantenimiento') DEFAULT 'proyecto',
        description TEXT,
        
        -- Project fields (type='proyecto')
        owner_id BIGINT UNSIGNED NULL COMMENT 'Project owner/responsible',
        client VARCHAR(255) NULL COMMENT 'Project client',
        client_id BIGINT UNSIGNED NULL COMMENT 'Client ID (if system user)',
        status ENUM('borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado') DEFAULT 'borrador',
        
        -- Dates
        start_date DATE NULL,
        expected_end_date DATE NULL,
        actual_end_date DATE NULL,
        
        -- Financial information
        total_budget DECIMAL(15,2) NULL COMMENT 'Total project budget',
        currency_id INT UNSIGNED DEFAULT 1,
        
        -- Location
        location VARCHAR(255) NULL,
        location_lat DOUBLE NULL,
        location_lon DOUBLE NULL,
        address TEXT NULL,
        
        -- Specific fields for administrative/operational centers
        department VARCHAR(100) NULL COMMENT 'Department (for administrative centers)',
        manager_id BIGINT UNSIGNED NULL COMMENT 'Center manager/responsible',
        budget_period ENUM('mensual', 'trimestral', 'anual') NULL COMMENT 'Budget period',
        
        -- General control
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Indexes
        INDEX idx_code (code),
        INDEX idx_type (type),
        INDEX idx_status (status),
        INDEX idx_owner (owner_id),
        INDEX idx_client (client_id),
        INDEX idx_manager (manager_id),
        INDEX idx_active (active)
      )
    `);
    console.log('✅ Tabla cost_centers creada (TABLA PRINCIPAL UNIFICADA)');
  } catch (error) {
    console.error('❌ Error creating cost_centers table:', error);
    throw error;
  }
}


// Add foreign keys to users after creating cost_centers
async function addUsersForeignKeys() {
  try {
    await conn.query(`
      ALTER TABLE users 
      ADD CONSTRAINT fk_user_cost_center 
      FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
    `);
    console.log('✅ Foreign key added: users.default_cost_center_id → cost_centers.id');
  } catch (error) {
    console.error('⚠️ Error adding users foreign key:', error.message);
  }
}

// Add foreign keys to cost_centers
async function addCostCentersForeignKeys() {
  try {
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_owner 
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_client 
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    `);
    
    await conn.query(`
      ALTER TABLE cost_centers 
      ADD CONSTRAINT fk_cost_center_manager 
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✅ Foreign keys added to cost_centers');
  } catch (error) {
    console.error('⚠️ Error adding cost_centers foreign keys:', error.message);
  }
}

// Create milestones table (now references cost_centers)
async function createMilestonesTable() {
  try {
    const exists = await checkTableExists('construction_milestones');
    if (exists) {
      console.log('ℹ️ Construction_milestones table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS construction_milestones (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Cost center (must be project type)',
        name VARCHAR(100) NOT NULL,
        description TEXT,
        planned_date DATE NOT NULL,
        actual_date DATE,
        amount DECIMAL(15,2),
        weight DECIMAL(5,2) DEFAULT 10.00,
        is_completed BOOLEAN DEFAULT FALSE,
        sequence INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
        INDEX idx_cost_center (cost_center_id)
      )
    `);
    console.log('✅ Construction_milestones table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating construction_milestones table:', error);
    throw error;
  }
}

// Create cash flow categories table
async function createCashFlowCategoriesTable() {
  try {
    const exists = await checkTableExists('cash_flow_categories');
    if (exists) {
      console.log('ℹ️ Cash_flow_categories table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_flow_categories (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type ENUM('ingreso', 'gasto', 'ambos') DEFAULT 'ambos',
        parent_id BIGINT UNSIGNED,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES cash_flow_categories(id)
      )
    `);
    console.log('✅ Cash_flow_categories table created');
  } catch (error) {
    console.error('❌ Error creating cash_flow_categories table:', error);
    throw error;
  }
}

// Create cash flow lines table (now references cost_centers)
async function createCashFlowLinesTable() {
  try {
    const exists = await checkTableExists('cash_flow_lines');
    if (exists) {
      console.log('ℹ️ Cash_flow_lines table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_flow_lines (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        name VARCHAR(255) NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        type ENUM('ingreso', 'gasto') NOT NULL,
        planned_date DATE NOT NULL,
        actual_date DATE,
        amount DECIMAL(15,2) NOT NULL,
        state ENUM('presupuestado', 'real') DEFAULT 'presupuestado',
        partner_id BIGINT UNSIGNED,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES cash_flow_categories(id),
        INDEX idx_cost_center (cost_center_id)
      )
    `);
    console.log('✅ Cash_flow_lines table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating cash_flow_lines table:', error);
    throw error;
  }
}

// ==========================================
// ACCOUNTING SYSTEM
// ==========================================

// Create accounting categories table (42 types)
async function createAccountCategoriesTable() {
  try {
    const exists = await checkTableExists('account_categories');
    if (exists) {
      console.log('ℹ️ Account_categories table already exists');
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
    console.log('✅ Account_categories table created (42 accounting categories)');
  } catch (error) {
    console.error('❌ Error creating account_categories table:', error);
    throw error;
  }
}

async function createEmployeesTable() {
  try {
    const exists = await checkTableExists('employees');
    if (exists) {
      console.log('ℹ️ Employees table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tax_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'RUT del empleado',
        full_name VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(50),
        emergency_phone VARCHAR(20) DEFAULT NULL COMMENT 'Emergency contact phone number',
        position VARCHAR(100),
        department VARCHAR(100),
        hire_date DATE,
        termination_date DATE,
        default_cost_center_id BIGINT UNSIGNED NULL,
        salary_base DECIMAL(15,2) NULL COMMENT 'Sueldo base mensual',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
        
        INDEX idx_tax_id (tax_id),
        INDEX idx_full_name (full_name),
        INDEX idx_position (position),
        INDEX idx_department (department),
        INDEX idx_active (active),
        INDEX idx_default_cost_center (default_cost_center_id)
      )
    `);
    console.log('✅ Employees table created');
  } catch (error) {
    console.error('❌ Error creating employees table:', error);
    throw error;
  }
}

async function evolveAccountingCostsTable() {
  try {
    // Verificar si ya tiene las nuevas columnas
    const [columns] = await conn.query('DESCRIBE accounting_costs');
    const hasTypeColumn = columns.some(col => col.Field === 'transaction_type');
    
    if (hasTypeColumn) {
      console.log('ℹ️ Accounting_costs table already evolved');
      return;
    }

    console.log('🔄 Evolving accounting_costs table...');
    console.log('📋 Se añadirán las siguientes columnas:');
    console.log('   - transaction_type: para separar ingresos de gastos');
    console.log('   - employee_id: referencia directa a empleados');
    console.log('   - period_year/month: para filtros rápidos por período');
    console.log('   - tags/metadata: campos JSON flexibles (opcional)');
    
    // ✅ PASO 1: Añadir nuevas columnas
    await conn.query(`
      ALTER TABLE accounting_costs 
      ADD COLUMN transaction_type ENUM('ingreso', 'gasto') NOT NULL DEFAULT 'gasto' AFTER cost_type,
      ADD COLUMN employee_id BIGINT UNSIGNED NULL AFTER supplier_id,
      ADD COLUMN period_year INT NOT NULL DEFAULT 2024 AFTER period,
      ADD COLUMN period_month INT NOT NULL DEFAULT 1 AFTER period_year,
      ADD COLUMN tags JSON NULL COMMENT 'Etiquetas para filtrado flexible',
      ADD COLUMN metadata JSON NULL COMMENT 'Metadatos adicionales flexibles'
    `);
    console.log('   ✅ Columnas añadidas');
    
    // ✅ PASO 2: Añadir foreign key para empleados
    await conn.query(`
      ALTER TABLE accounting_costs 
      ADD FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    `);
    console.log('   ✅ Foreign key a employees añadida');
    
    // ✅ PASO 3: Poblar los nuevos campos basado en datos existentes
    await conn.query(`
      UPDATE accounting_costs 
      SET 
        period_year = YEAR(date),
        period_month = MONTH(date),
        transaction_type = 'gasto'
      WHERE period_year = 2024 AND period_month = 1
    `);
    console.log('   ✅ Campos poblados con datos existentes');
    
    // ✅ PASO 4: Crear índices para navegación rápida
    await conn.query('CREATE INDEX idx_transaction_type ON accounting_costs(transaction_type)');
    await conn.query('CREATE INDEX idx_period_year_month ON accounting_costs(period_year, period_month)');
    await conn.query('CREATE INDEX idx_employee ON accounting_costs(employee_id)');
    await conn.query(`CREATE INDEX idx_multidim_navigation ON accounting_costs(
      cost_center_id, account_category_id, transaction_type, period_year, period_month
    )`);
    console.log('   ✅ Índices para navegación multidimensional creados');
    
    console.log('✅ Accounting_costs evolucionada exitosamente');
    console.log('🎯 Ahora tu tabla soporta navegación tipo ecommerce');
    
  } catch (error) {
    console.error('❌ Error evolving accounting_costs table:', error);
    throw error;
  }
}

async function createMultidimensionalView() {
  try {
    console.log('🔄 Creating unified multidimensional view...');
    console.log('📋 Esta vista permitirá:');
    console.log('   - Filtros súper rápidos sin JOINs complejos');
    console.log('   - Navegación tipo ecommerce (productos, categorías, marcas)');
    console.log('   - Breadcrumbs dinámicos');
    console.log('   - Drill-down automático por dimensiones');
    console.log('   - ✨ UNIFICA: accounting_costs + purchase_orders + fixed_costs');
    
    await conn.query('DROP VIEW IF EXISTS multidimensional_costs_view');

    await conn.query(`
      CREATE VIEW multidimensional_costs_view AS
      -- ==========================================
      -- PARTE 1: ACCOUNTING COSTS (origen principal)
      -- ==========================================
      SELECT 
        -- ✅ IDENTIFICADORES PRINCIPALES
        ac.id as cost_id,
        ac.transaction_type,
        ac.cost_type,
        ac.amount,
        ac.description,
        ac.date,
        ac.period_year,
        ac.period_month,
        ac.status,
        
        -- ✅ DIMENSIÓN: Centro de Costo (como "Marca" en ecommerce)
        cc.id as cost_center_id,
        cc.code as cost_center_code,
        cc.name as cost_center_name,
        cc.type as cost_center_type,
        cc.client as cost_center_client,
        cc.status as cost_center_status,
        
        -- ✅ DIMENSIÓN: Categoría Contable (como "Categoría" en ecommerce)
        cat.id as category_id,
        cat.code as category_code,
        cat.name as category_name,
        cat.type as category_type,
        cat.group_name as category_group,
        
        -- ✅ DIMENSIÓN: Proveedor (como "Tag" en ecommerce)
        s.id as supplier_id,
        s.tax_id as supplier_tax_id,
        s.legal_name as supplier_name,
        s.commercial_name as supplier_commercial_name,
        
        -- ✅ DIMENSIÓN: Empleado (como "Tag" en ecommerce)
        e.id as employee_id,
        e.tax_id as employee_tax_id,
        e.full_name as employee_name,
        e.position as employee_position,
        e.department as employee_department,
        
        -- ✅ DIMENSIÓN: Fuente del Documento (como "Variant" en ecommerce)
        CASE 
          WHEN ac.purchase_order_id IS NOT NULL THEN 'orden_compra_ref'
          WHEN ac.payroll_id IS NOT NULL THEN 'nomina'
          WHEN ac.social_security_id IS NOT NULL THEN 'seguridad_social'
          WHEN ac.invoice_id IS NOT NULL THEN 'factura'
          ELSE 'manual'
        END as source_type,
        
        COALESCE(
          ac.purchase_order_id,
          ac.payroll_id, 
          ac.social_security_id,
          ac.invoice_id,
          ac.id
        ) as source_id,
        
        -- ✅ CAMPOS CALCULADOS PARA NAVEGACIÓN
        CONCAT(ac.period_year, '-', LPAD(ac.period_month, 2, '0')) as period_key,
        CONCAT(cc.type, ': ', cc.name) as cost_center_display,
        CONCAT(cat.group_name, ': ', cat.name) as category_display,
        
        -- ✅ CAMPOS ADICIONALES PARA DRILL-DOWN
        ac.notes,
        ac.reference_document,
        NULL as po_number,
        NULL as po_date,
        
        -- ✅ TIMESTAMPS
        ac.created_at,
        ac.updated_at
        
      FROM accounting_costs ac
      LEFT JOIN cost_centers cc ON ac.cost_center_id = cc.id
      LEFT JOIN account_categories cat ON ac.account_category_id = cat.id
      LEFT JOIN suppliers s ON ac.supplier_id = s.id
      LEFT JOIN employees e ON ac.employee_id = e.id
      WHERE ac.status = 'confirmado'

      UNION ALL

      -- ==========================================
      -- PARTE 2: PURCHASE ORDERS (como gastos directos)
      -- ==========================================
      SELECT 
        -- ✅ IDENTIFICADORES PRINCIPALES (mapeo desde purchase_orders)
        po.id as cost_id,
        'gasto' as transaction_type,
        'real' as cost_type,
  (SELECT COALESCE(SUM(i.total),0) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) as amount,
        po.description,
        po.po_date as date,
        YEAR(po.po_date) as period_year,
        MONTH(po.po_date) as period_month,
        po.status,
        
        -- ✅ DIMENSIÓN: Centro de Costo
        cc.id as cost_center_id,
        cc.code as cost_center_code,
        cc.name as cost_center_name,
        cc.type as cost_center_type,
        cc.client as cost_center_client,
        cc.status as cost_center_status,
        
        -- ✅ DIMENSIÓN: Categoría Contable
        cat.id as category_id,
        cat.code as category_code,
        cat.name as category_name,
        cat.type as category_type,
        cat.group_name as category_group,
        
        -- ✅ DIMENSIÓN: Proveedor (desde purchase_orders)
        s.id as supplier_id,
        s.tax_id as supplier_tax_id,
        s.legal_name as supplier_name,
        s.commercial_name as supplier_commercial_name,
        
        -- ✅ DIMENSIÓN: Empleado (NULL para purchase_orders)
        NULL as employee_id,
        NULL as employee_tax_id,
        NULL as employee_name,
        NULL as employee_position,
        NULL as employee_department,
        
        -- ✅ FUENTE DEL DOCUMENTO
        'orden_compra' as source_type,
        po.id as source_id,
        
        -- ✅ CAMPOS PARA NAVEGACIÓN
        CONCAT(YEAR(po.po_date), '-', LPAD(MONTH(po.po_date), 2, '0')) as period_key,
        CONCAT(cc.type, ': ', cc.name) as cost_center_display,
        CONCAT(COALESCE(cat.group_name, 'Sin Grupo'), ': ', COALESCE(cat.name, 'Sin Categoría')) as category_display,
        
        -- ✅ CAMPOS ADICIONALES ESPECÍFICOS DE PO
  NULL as notes,
        po.po_number as reference_document,
        po.po_number,
        po.po_date,
        
        -- ✅ TIMESTAMPS
        po.created_at,
        po.updated_at
        
      FROM purchase_orders po
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id
      LEFT JOIN account_categories cat ON po.account_category_id = cat.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id

      UNION ALL

      -- ==========================================
      -- PARTE 3: FIXED COSTS (costos fijos periódicos)
      -- ==========================================
      SELECT
        -- ✅ Generar IDs únicos para fixed_costs (añadir 100000 para evitar conflictos)
        (fc.id + 100000) as cost_id,
        'gasto' as transaction_type,
        'real' as cost_type,
        fc.quota_value as amount,
        CONCAT('Costo Fijo: ', fc.name) as description,
        
        -- ✅ Usar next_payment_date o start_date como fecha
        COALESCE(fc.next_payment_date, fc.start_date) as date,
        YEAR(COALESCE(fc.next_payment_date, fc.start_date)) as period_year,
        MONTH(COALESCE(fc.next_payment_date, fc.start_date)) as period_month,
        
        -- ✅ Mapear estado de fixed_costs a estados generales
        CASE 
          WHEN fc.state = 'active' THEN 'aprobado'
          WHEN fc.state = 'completed' THEN 'pagado'
          WHEN fc.state = 'suspended' THEN 'pendiente'
          WHEN fc.state = 'cancelled' THEN 'rechazado'
          ELSE 'borrador'
        END as status,
        
        -- ✅ DIMENSIÓN: Centro de Costo
        cc.id as cost_center_id,
        cc.code as cost_center_code,
        cc.name as cost_center_name,
        cc.type as cost_center_type,
        cc.client as cost_center_client,
        cc.status as cost_center_status,
        
        -- ✅ DIMENSIÓN: Categoría Contable
        cat.id as category_id,
        cat.code as category_code,
        cat.name as category_name,
        cat.type as category_type,
        cat.group_name as category_group,
        
        -- ✅ DIMENSIÓN: Proveedor (NULL para fixed_costs)
        NULL as supplier_id,
        NULL as supplier_tax_id,
        NULL as supplier_name,
        NULL as supplier_commercial_name,
        
        -- ✅ DIMENSIÓN: Empleado (NULL para fixed_costs)
        NULL as employee_id,
        NULL as employee_tax_id,
        NULL as employee_name,
        NULL as employee_position,
        NULL as employee_department,
        
        -- ✅ FUENTE DEL DOCUMENTO
        'costo_fijo' as source_type,
        fc.id as source_id,
        
        -- ✅ CAMPOS PARA NAVEGACIÓN
        CONCAT(YEAR(COALESCE(fc.next_payment_date, fc.start_date)), '-', 
               LPAD(MONTH(COALESCE(fc.next_payment_date, fc.start_date)), 2, '0')) as period_key,
        CONCAT(cc.type, ': ', cc.name) as cost_center_display,
        CONCAT(COALESCE(cat.group_name, 'Sin Grupo'), ': ', COALESCE(cat.name, 'Sin Categoría')) as category_display,
        
        -- ✅ CAMPOS ADICIONALES ESPECÍFICOS DE FIXED COSTS
        CONCAT('Cuotas: ', fc.paid_quotas, '/', fc.quota_count, ' - Vigente hasta: ', DATE_FORMAT(fc.end_date, '%Y-%m-%d')) as notes,
        CONCAT('FC-', fc.id) as reference_document,
        NULL as po_number,
        NULL as po_date,
        
        -- ✅ TIMESTAMPS
        fc.created_at,
        fc.updated_at
        
      FROM fixed_costs fc
      LEFT JOIN cost_centers cc ON fc.cost_center_id = cc.id
      LEFT JOIN account_categories cat ON fc.account_category_id = cat.id
      WHERE fc.state IN ('active', 'completed', 'suspended', 'draft')  -- Excluir solo cancelados

      UNION ALL

      -- ==========================================
      -- PARTE 4: PURCHASE ORDER ITEMS (ítems detallados de órdenes de compra)
      -- ==========================================
      SELECT
        -- ✅ Generar IDs únicos para purchase_order_items (añadir 200000 para evitar conflictos)
        (poi.id + 200000) as cost_id,
        'gasto' as transaction_type,
        'real' as cost_type,
        poi.total as amount,
        CONCAT('Item OC: ', COALESCE(poi.description, po.description)) as description,
        
        -- ✅ Usar fecha del item o fecha de la PO
        COALESCE(poi.date, po.po_date) as date,
        YEAR(COALESCE(poi.date, po.po_date)) as period_year,
        MONTH(COALESCE(poi.date, po.po_date)) as period_month,
        po.status,
        
        -- ✅ DIMENSIÓN: Centro de Costo (preferir el del item, luego el de la PO)
        COALESCE(poi_cc.id, po_cc.id) as cost_center_id,
        COALESCE(poi_cc.code, po_cc.code) as cost_center_code,
        COALESCE(poi_cc.name, po_cc.name) as cost_center_name,
        COALESCE(poi_cc.type, po_cc.type) as cost_center_type,
        COALESCE(poi_cc.client, po_cc.client) as cost_center_client,
        COALESCE(poi_cc.status, po_cc.status) as cost_center_status,
        
        -- ✅ DIMENSIÓN: Categoría Contable (preferir la del item, luego la de la PO)
        COALESCE(poi_cat.id, po_cat.id) as category_id,
        COALESCE(poi_cat.code, po_cat.code) as category_code,
        COALESCE(poi_cat.name, po_cat.name) as category_name,
        COALESCE(poi_cat.type, po_cat.type) as category_type,
        COALESCE(poi_cat.group_name, po_cat.group_name) as category_group,
        
        -- ✅ DIMENSIÓN: Proveedor (desde purchase_orders)
        s.id as supplier_id,
        s.tax_id as supplier_tax_id,
        s.legal_name as supplier_name,
        s.commercial_name as supplier_commercial_name,
        
        -- ✅ DIMENSIÓN: Empleado (NULL para purchase_order_items)
        NULL as employee_id,
        NULL as employee_tax_id,
        NULL as employee_name,
        NULL as employee_position,
        NULL as employee_department,
        
        -- ✅ FUENTE DEL DOCUMENTO
        'orden_compra_item' as source_type,
        poi.id as source_id,
        
        -- ✅ CAMPOS PARA NAVEGACIÓN
        CONCAT(YEAR(COALESCE(poi.date, po.po_date)), '-', 
               LPAD(MONTH(COALESCE(poi.date, po.po_date)), 2, '0')) as period_key,
        CONCAT(COALESCE(poi_cc.type, po_cc.type), ': ', COALESCE(poi_cc.name, po_cc.name)) as cost_center_display,
        CONCAT(COALESCE(COALESCE(poi_cat.group_name, po_cat.group_name), 'Sin Grupo'), ': ', 
               COALESCE(COALESCE(poi_cat.name, po_cat.name), 'Sin Categoría')) as category_display,
        
        -- ✅ CAMPOS ADICIONALES ESPECÍFICOS DE PURCHASE ORDER ITEMS
        CONCAT('Glosa: ', COALESCE(poi.glosa, 'Sin glosa'), ' - Moneda: ', poi.currency) as notes,
        CONCAT(po.po_number, '-', poi.id) as reference_document,
        po.po_number,
        po.po_date,
        
        -- ✅ TIMESTAMPS
        poi.created_at,
        poi.updated_at
        
      FROM purchase_order_items poi
      INNER JOIN purchase_orders po ON poi.purchase_order_id = po.id
      LEFT JOIN cost_centers poi_cc ON poi.cost_center_id = poi_cc.id
      LEFT JOIN cost_centers po_cc ON po.cost_center_id = po_cc.id
      LEFT JOIN account_categories poi_cat ON poi.account_category_id = poi_cat.id
      LEFT JOIN account_categories po_cat ON po.account_category_id = po_cat.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.status IN ('activo', 'en_progreso', 'completado')  -- Excluir borradores y cancelados
      
      ORDER BY date DESC, created_at DESC
    `);
    
    console.log('✅ Vista multidimensional UNIFICADA creada');
    console.log('🎯 Ahora incluye CUATRO fuentes:');
    console.log('   📊 accounting_costs (source_type: manual, nomina, etc.)');
    console.log('   📊 purchase_orders (source_type: orden_compra)');
    console.log('   📊 purchase_order_items (source_type: orden_compra_item) ← NUEVO');
    console.log('   📊 fixed_costs (source_type: costo_fijo)');
    console.log('');
    console.log('🎯 Ejemplos de consultas:');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE cost_center_type = "proyecto"');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE source_type = "orden_compra"');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE source_type = "orden_compra_item"');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE source_type = "costo_fijo"');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE category_group = "Materiales"');
    console.log('   SELECT * FROM multidimensional_costs_view WHERE cost_center_id = 2 AND category_id = 14');
    console.log('');
    console.log('🎯 Fuentes disponibles por source_type:');
    console.log('   - manual: Costos ingresados manualmente');
    console.log('   - nomina: Costos de nómina/payroll');
    console.log('   - seguridad_social: Cotizaciones previsionales');
    console.log('   - factura: Costos vinculados a facturas');
    console.log('   - orden_compra_ref: Accounting costs referenciando PO');
    console.log('   - orden_compra: Purchase orders directas');
    console.log('   - orden_compra_item: Items detallados de purchase orders ← NUEVO');
    console.log('   - costo_fijo: Fixed costs periódicos');
    
  } catch (error) {
    console.error('❌ Error creating unified multidimensional view:', error);
    throw error;
  }
}

async function createFixedCostsTable() {
  try {
    const exists = await checkTableExists('fixed_costs');
    if (exists) {
      console.log('ℹ️ Fixed_costs table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS fixed_costs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL COMMENT 'Nombre del costo fijo',
        description TEXT COMMENT 'Descripción detallada',
        quota_value DECIMAL(15,2) NOT NULL COMMENT 'Valor de cada cuota',
        quota_count INT NOT NULL COMMENT 'Número total de cuotas',
        paid_quotas INT DEFAULT 0 COMMENT 'Cuotas pagadas hasta ahora',
        start_date DATE NOT NULL COMMENT 'Fecha de inicio',
        end_date DATE NOT NULL COMMENT 'Fecha de término',
        payment_date DATE NOT NULL COMMENT 'Día de pago mensual',
        next_payment_date DATE COMMENT 'Próxima fecha de pago calculada',
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Centro de costo/proyecto',
        account_category_id BIGINT UNSIGNED COMMENT 'Categoría contable',
        company_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
        state ENUM('draft', 'active', 'suspended', 'completed', 'cancelled') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
        FOREIGN KEY (account_category_id) REFERENCES account_categories(id),
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_account_category (account_category_id),
        INDEX idx_state (state),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        INDEX idx_next_payment_date (next_payment_date),
        INDEX idx_company (company_id)
      )
    `);
    console.log('✅ Fixed_costs table created');
  } catch (error) {
    console.error('❌ Error creating fixed_costs table:', error);
    throw error;
  }
}

// Agregar datos de prueba (opcional)
async function insertFixedCostsTestData() {
  try {
    // Verificar si ya hay datos
    const [existingData] = await conn.query('SELECT COUNT(*) as count FROM fixed_costs');
    if (existingData[0].count > 0) {
      console.log('ℹ️ Fixed costs test data already exists');
      return;
    }

    await conn.query(`
      INSERT INTO fixed_costs (
        name, description, quota_value, quota_count, paid_quotas,
        start_date, end_date, payment_date, next_payment_date,
        cost_center_id, account_category_id, state
      ) VALUES 
      (
        'Arriendo Oficina Central',
        'Arriendo mensual de oficina principal',
        850000.00,
        12,
        3,
        '2024-01-01',
        '2024-12-31',
        '2024-01-05',
        '2024-04-05',
        1,
        1,
        'active'
      ),
      (
        'Leasing Equipos de Oficina',
        'Arriendo de equipos informáticos y mobiliario',
        450000.00,
        24,
        8,
        '2023-06-01',
        '2025-05-31',
        '2023-06-15',
        '2024-04-15',
        1,
        2,
        'active'
      ),
      (
        'Plan Celulares Empresa',
        'Plan corporativo de telefonía móvil',
        180000.00,
        12,
        2,
        '2024-02-01',
        '2025-01-31',
        '2024-02-10',
        '2024-04-10',
        1,
        3,
        'active'
      )
    `);
    console.log('✅ Fixed costs test data inserted');
  } catch (error) {
    console.error('❌ Error inserting fixed costs test data:', error);
    throw error;
  }
}

const empleadosFake = [
  // DIRECCIÓN Y ADMINISTRACIÓN
  {
    tax_id: '12345678-9',
    full_name: 'Carlos Alberto Mendoza Sánchez',
    first_name: 'Carlos Alberto',
    last_name: 'Mendoza Sánchez',
    email: 'cmendoza@saer.cl',
    phone: '+56912345678',
    emergency_phone: '+56987654321',
    position: 'Gerente General',
    department: 'Dirección',
    hire_date: '2020-01-15',
    salary_base: 4500000
  },
  {
    tax_id: '98765432-1',
    full_name: 'María Elena Torres Rojas',
    first_name: 'María Elena',
    last_name: 'Torres Rojas',
    email: 'mtorres@saer.cl',
    phone: '+56923456789',
    emergency_phone: '+56976543210',
    position: 'Jefa de Administración y Finanzas',
    department: 'Administración',
    hire_date: '2020-03-01',
    salary_base: 3200000
  },
  {
    tax_id: '11223344-5',
    full_name: 'Rodrigo Ignacio Vega López',
    first_name: 'Rodrigo Ignacio',
    last_name: 'Vega López',
    email: 'rvega@saer.cl',
    phone: '+56934567890',
    emergency_phone: '+56965432109',
    position: 'Contador',
    department: 'Administración',
    hire_date: '2021-02-15',
    salary_base: 2100000
  },
  {
    tax_id: '55667788-9',
    full_name: 'Patricia Andrea Silva Muñoz',
    first_name: 'Patricia Andrea',
    last_name: 'Silva Muñoz',
    email: 'psilva@saer.cl',
    phone: '+56945678901',
    emergency_phone: '+56954321098',
    position: 'Asistente Administrativo',
    department: 'Administración',
    hire_date: '2022-01-10',
    salary_base: 850000
  },

  // INGENIERÍA Y PROYECTOS
  {
    tax_id: '22334455-6',
    full_name: 'Juan Carlos Pérez Morales',
    first_name: 'Juan Carlos',
    last_name: 'Pérez Morales',
    email: 'jperez@saer.cl',
    phone: '+56956789012',
    emergency_phone: '+56943210987',
    position: 'Jefe de Proyectos',
    department: 'Ingeniería',
    hire_date: '2019-11-20',
    salary_base: 3800000
  },
  {
    tax_id: '33445566-7',
    full_name: 'Ana Sofía Ramírez Castro',
    first_name: 'Ana Sofía',
    last_name: 'Ramírez Castro',
    email: 'aramirez@saer.cl',
    phone: '+56967890123',
    emergency_phone: '+56932109876',
    position: 'Ingeniera Civil',
    department: 'Ingeniería',
    hire_date: '2021-04-01',
    salary_base: 2800000
  },
  {
    tax_id: '44556677-8',
    full_name: 'Miguel Ángel Contreras Díaz',
    first_name: 'Miguel Ángel',
    last_name: 'Contreras Díaz',
    email: 'mcontreras@saer.cl',
    phone: '+56978901234',
    emergency_phone: '+56921098765',
    position: 'Ingeniero de Proyectos',
    department: 'Ingeniería',
    hire_date: '2021-08-15',
    salary_base: 2500000
  },
  {
    tax_id: '66778899-0',
    full_name: 'Francisco Javier Herrera Pino',
    first_name: 'Francisco Javier',
    last_name: 'Herrera Pino',
    email: 'fherrera@saer.cl',
    phone: '+56989012345',
    emergency_phone: '+56910987654',
    position: 'Topógrafo',
    department: 'Ingeniería',
    hire_date: '2022-03-01',
    salary_base: 1800000
  },

  // OPERACIONES Y TERRENO
  {
    tax_id: '77889900-1',
    full_name: 'Roberto Alejandro González Fuentes',
    first_name: 'Roberto Alejandro',
    last_name: 'González Fuentes',
    email: 'rgonzalez@saer.cl',
    phone: '+56990123456',
    emergency_phone: '+56998765432',
    position: 'Jefe de Terreno',
    department: 'Operaciones',
    hire_date: '2020-05-15',
    salary_base: 2200000
  },
  {
    tax_id: '88990011-2',
    full_name: 'Luis Fernando Moreno Soto',
    first_name: 'Luis Fernando',
    last_name: 'Moreno Soto',
    email: 'lmoreno@saer.cl',
    phone: '+56901234567',
    emergency_phone: '+56987654321',
    position: 'Capataz General',
    department: 'Operaciones',
    hire_date: '2019-09-01',
    salary_base: 1600000
  },
  {
    tax_id: '99001122-3',
    full_name: 'Pedro Antonio Vargas Espinoza',
    first_name: 'Pedro Antonio',
    last_name: 'Vargas Espinoza',
    email: 'pvargas@saer.cl',
    phone: '+56912345670',
    emergency_phone: '+56976543210',
    position: 'Operador de Maquinaria',
    department: 'Operaciones',
    hire_date: '2021-06-01',
    salary_base: 1200000
  },
  {
    tax_id: '10203040-5',
    full_name: 'Jorge Enrique Castillo Vera',
    first_name: 'Jorge Enrique',
    last_name: 'Castillo Vera',
    email: 'jcastillo@saer.cl',
    phone: '+56923456781',
    emergency_phone: '+56965432109',
    position: 'Maestro Soldador',
    department: 'Operaciones',
    hire_date: '2020-08-15',
    salary_base: 1400000
  },

  // LOGÍSTICA Y BODEGA
  {
    tax_id: '20304050-6',
    full_name: 'Carmen Gloria Navarro Rojas',
    first_name: 'Carmen Gloria',
    last_name: 'Navarro Rojas',
    email: 'cnavarro@saer.cl',
    phone: '+56934567892',
    emergency_phone: '+56954321098',
    position: 'Jefa de Bodega',
    department: 'Logística',
    hire_date: '2021-01-15',
    salary_base: 1300000
  },
  {
    tax_id: '30405060-7',
    full_name: 'Andrés Felipe Cortés Miranda',
    first_name: 'Andrés Felipe',
    last_name: 'Cortés Miranda',
    email: 'acortes@saer.cl',
    phone: '+56945678903',
    emergency_phone: '+56943210987',
    position: 'Encargado de Compras',
    department: 'Logística',
    hire_date: '2022-02-01',
    salary_base: 1100000
  },
  {
    tax_id: '40506070-8',
    full_name: 'Marcela Beatriz Jiménez Flores',
    first_name: 'Marcela Beatriz',
    last_name: 'Jiménez Flores',
    email: 'mjimenez@saer.cl',
    phone: '+56956789014',
    emergency_phone: '+56932109876',
    position: 'Asistente de Bodega',
    department: 'Logística',
    hire_date: '2022-09-15',
    salary_base: 750000
  },

  // PREVENCIÓN DE RIESGOS Y CALIDAD
  {
    tax_id: '50607080-9',
    full_name: 'Daniel Esteban Ruiz Paredes',
    first_name: 'Daniel Esteban',
    last_name: 'Ruiz Paredes',
    email: 'druiz@saer.cl',
    phone: '+56967890125',
    emergency_phone: '+56921098765',
    position: 'Prevencionista de Riesgos',
    department: 'Prevención',
    hire_date: '2020-12-01',
    salary_base: 1900000
  },
  {
    tax_id: '60708090-0',
    full_name: 'Claudia Marcela Santander López',
    first_name: 'Claudia Marcela',
    last_name: 'Santander López',
    email: 'csantander@saer.cl',
    phone: '+56978901236',
    emergency_phone: '+56910987654',
    position: 'Inspectora de Calidad',
    department: 'Calidad',
    hire_date: '2021-07-01',
    salary_base: 1700000
  },

  // RECURSOS HUMANOS
  {
    tax_id: '70809010-1',
    full_name: 'Valentina Esperanza Osorio Carrasco',
    first_name: 'Valentina Esperanza',
    last_name: 'Osorio Carrasco',
    email: 'vosorio@saer.cl',
    phone: '+56989012347',
    emergency_phone: '+56998765432',
    position: 'Encargada de Recursos Humanos',
    department: 'RRHH',
    hire_date: '2020-10-15',
    salary_base: 2000000
  },

  // OPERARIOS Y TÉCNICOS
  {
    tax_id: '80901020-2',
    full_name: 'Cristian Mauricio Albornoz Silva',
    first_name: 'Cristian Mauricio',
    last_name: 'Albornoz Silva',
    email: 'calbornoz@saer.cl',
    phone: '+56990123458',
    emergency_phone: '+56987654321',
    position: 'Técnico Eléctrico',
    department: 'Operaciones',
    hire_date: '2021-11-01',
    salary_base: 1100000
  },
  {
    tax_id: '90102030-3',
    full_name: 'Sebastián Ignacio Parra Mendoza',
    first_name: 'Sebastián Ignacio',
    last_name: 'Parra Mendoza',
    email: 'sparra@saer.cl',
    phone: '+56901234569',
    emergency_phone: '+56976543210',
    position: 'Operario de Construcción',
    department: 'Operaciones',
    hire_date: '2022-05-15',
    salary_base: 900000
  },
  {
    tax_id: '01020304-5',
    full_name: 'Manuel Eduardo Reyes Gutiérrez',
    first_name: 'Manuel Eduardo',
    last_name: 'Reyes Gutiérrez',
    email: 'mreyes@saer.cl',
    phone: '+56912345681',
    emergency_phone: '+56965432109',
    position: 'Ayudante de Construcción',
    department: 'Operaciones',
    hire_date: '2023-01-10',
    salary_base: 650000
  }
];

async function insertRealEmployees(employeesData = null) {
  try {
    const [existingEmployees] = await conn.query('SELECT COUNT(*) as count FROM employees');
    
    if (existingEmployees[0].count > 0) {
      console.log('ℹ️ Employees already exist, skipping insert');
      return;
    }

    // Si no se proporcionan datos, usar los empleados fake
    const dataToInsert = employeesData || empleadosFake;
    
    if (dataToInsert.length === 0) {
      console.log('⏳ No employee data provided, skipping insert');
      console.log('📝 Provide employee data to insertRealEmployees() function');
      return;
    }

    // Obtener centro de costo administrativo por defecto
    const [defaultCenter] = await conn.query(
      'SELECT id FROM cost_centers WHERE type = "administrativo" ORDER BY id ASC LIMIT 1'
    );
    const defaultCostCenterId = defaultCenter[0]?.id;

    console.log(`👥 Inserting ${dataToInsert.length} ${employeesData ? 'real' : 'fake'} employees...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (const emp of dataToInsert) {
      try {
        await conn.query(`
          INSERT INTO employees (
            tax_id, full_name, first_name, last_name, email, phone, emergency_phone,
            position, department, hire_date, default_cost_center_id, salary_base
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          emp.tax_id,
          emp.full_name,
          emp.first_name || emp.full_name.split(' ')[0],
          emp.last_name || emp.full_name.split(' ').slice(1).join(' '),
          emp.email || null,
          emp.phone || null,
          emp.emergency_phone || null,
          emp.position || 'Empleado',
          emp.department || 'General',
          emp.hire_date || new Date().toISOString().split('T')[0],
          defaultCostCenterId,
          emp.salary_base || null
        ]);
        
        console.log(`  ✅ ${emp.full_name} (${emp.tax_id}) - ${emp.position}`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error insertando ${emp.full_name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen de inserción de empleados:`);
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📄 Total procesados: ${dataToInsert.length}`);
    
    if (errorCount === 0) {
      console.log('🎉 Todos los empleados fueron insertados exitosamente');
    }

  } catch (error) {
    console.error('❌ Error inserting employees:', error);
    throw error;
  }
}

async function implementHito1Simplified(employeesData = []) {
  console.log('\n🎯 IMPLEMENTANDO HITO 1 SIMPLIFICADO');
  console.log('📋 Solo lo esencial: Employees + Evolución + Vista');
  
  try {
    // Paso 1: Crear tabla de empleados
    console.log('\n1️⃣ Creando tabla de empleados...');
    await createEmployeesTable();
    
    // Paso 2: Evolucionar tabla accounting_costs
    console.log('\n2️⃣ Evolucionando tabla accounting_costs...');
    await evolveAccountingCostsTable();
    
    // Paso 2.1: Evolucionar tabla purchase_order_items
    console.log('\n2️⃣.1 Evolucionando tabla purchase_order_items...');
    await evolvePurchaseOrderItemsTable();
    
    // Paso 3: Crear vista multidimensional
    console.log('\n3️⃣ Creando vista multidimensional...');
    await createMultidimensionalView();
    
    // Paso 4: Insertar empleados reales
    console.log('\n4️⃣ Insertando empleados...');
    await insertRealEmployees(employeesData);
    
    console.log('\n✅ HITO 1 SIMPLIFICADO COMPLETADO');
    console.log('🎯 Funcionalidades implementadas:');
    console.log('   ✅ Tabla employees robusta');
    console.log('   ✅ accounting_costs evolucionada con navegación multidimensional');
    console.log('   ✅ purchase_order_items evolucionada con cost_center_id y account_category_id');
    console.log('   ✅ Vista multidimensional para filtros tipo ecommerce');
    console.log('   ✅ Empleados reales insertados');
    console.log('\n🚀 Tu sistema está listo para navegación multidimensional!');
    
  } catch (error) {
    console.error('❌ Error en Hito 1 Simplificado:', error);
    throw error;
  }
}

async function createClientsTable() {
  try {
    const exists = await checkTableExists('clients');
    if (exists) {
      console.log('ℹ️ Clients table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tax_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'RUT or Tax ID',
        legal_name VARCHAR(255) NOT NULL COMMENT 'Legal business name',
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
        INDEX idx_tax_id (tax_id),
        INDEX idx_legal_name (legal_name)
      )
    `);
    console.log('✅ Clients table created');
  } catch (error) {
    console.error('❌ Error creating clients table:', error);
    throw error;
  }
}

async function insertClients() {
  try {
    const [existingClients] = await conn.query('SELECT COUNT(*) as count FROM clients');
    
    if (existingClients[0].count > 0) {
      console.log('ℹ️ Clients are already configured');
      return;
    }

    await conn.query(`
      INSERT INTO clients (tax_id, legal_name, commercial_name, client_type) VALUES
      ('77777777-7', 'Ministerio de Obras Públicas', 'MOP', 'publico'),
      ('88888888-8', 'Municipalidad de Valdivia', 'Muni Valdivia', 'publico'),
      ('99999999-9', 'Corporación Nacional del Cobre de Chile', 'CODELCO', 'publico'),
      ('11111111-1', 'Banco Santander Chile S.A.', 'Santander', 'privado')
    `);
    
    console.log('✅ 4 clients inserted');
  } catch (error) {
    console.error('❌ Error inserting clients:', error);
    throw error;
  }
}

// Create suppliers table
async function createSuppliersTable() {
  try {
    const exists = await checkTableExists('suppliers');
    if (exists) {
      console.log('ℹ️ Suppliers table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        tax_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'RUT or Tax ID',
        legal_name VARCHAR(255) NOT NULL COMMENT 'Legal business name',
        commercial_name VARCHAR(255),
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(100),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tax_id (tax_id),
        INDEX idx_legal_name (legal_name)
      )
    `);
    console.log('✅ Suppliers table created');
  } catch (error) {
    console.error('❌ Error creating suppliers table:', error);
    throw error;
  }
}

// Create purchase orders table (now references cost_centers)
async function createPurchaseOrdersTable() {
  try {
    const exists = await checkTableExists('purchase_orders');
    if (exists) {
      console.log('ℹ️ Purchase_orders table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        po_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Purchase Order Number',
        po_date DATE NOT NULL,
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        supplier_id BIGINT UNSIGNED,
        supplier_name VARCHAR(255),
        account_category_id BIGINT UNSIGNED,
  description TEXT,
        status ENUM('borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado') DEFAULT 'borrador',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (account_category_id) REFERENCES account_categories(id),
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        INDEX idx_po_number (po_number),
        INDEX idx_date (po_date),
        INDEX idx_account_category (account_category_id),
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_supplier (supplier_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Purchase_orders table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating purchase_orders table:', error);
    throw error;
  }
}
async function createPurchaseOrderItemsTable() {
  try {
    const exists = await checkTableExists('purchase_order_items');
    if (exists) {
      console.log('ℹ️ purchase_order_items ya existe, se omite creación');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        purchase_order_id BIGINT UNSIGNED NOT NULL COMMENT 'FK a purchase_orders',
        cost_center_id BIGINT UNSIGNED NULL COMMENT 'Centro de costo asociado al ítem',
        account_category_id BIGINT UNSIGNED NULL COMMENT 'Categoría contable del ítem',
        date DATE NOT NULL COMMENT 'Fecha del ítem',
        description TEXT NULL COMMENT 'Descripción detallada',
        glosa TEXT NULL COMMENT 'Glosa / nota',
        currency VARCHAR(10) DEFAULT 'CLP' COMMENT 'Moneda del ítem',
        total DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Monto total del ítem',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL,
        FOREIGN KEY (account_category_id) REFERENCES account_categories(id) ON DELETE SET NULL,
        INDEX idx_po (purchase_order_id),
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_account_category (account_category_id),
        INDEX idx_date (date)
      )
    `);

    console.log('✅ Tabla purchase_order_items creada (→ purchase_orders, cost_centers, account_categories)');
  } catch (error) {
    console.error('❌ Error creando purchase_order_items:', error);
    throw error;
  }
}

// Evolve existing purchase_order_items table to add new foreign keys
async function evolvePurchaseOrderItemsTable() {
  try {
    // Check if the table exists
    const exists = await checkTableExists('purchase_order_items');
    if (!exists) {
      console.log('ℹ️ purchase_order_items table does not exist, skipping evolution');
      return;
    }

    // Check if the new columns already exist
    const [columns] = await conn.query('DESCRIBE purchase_order_items');
    const hasCostCenterColumn = columns.some(col => col.Field === 'cost_center_id');
    const hasAccountCategoryColumn = columns.some(col => col.Field === 'account_category_id');

    if (hasCostCenterColumn && hasAccountCategoryColumn) {
      console.log('ℹ️ purchase_order_items table already has the new columns, skipping evolution');
      return;
    }

    console.log('🔄 Evolucionando tabla purchase_order_items...');
    console.log('📋 Se añadirán las siguientes columnas:');
    console.log('   - cost_center_id: para asociar cada ítem a un centro de costo específico');
    console.log('   - account_category_id: para categorizar contablemente cada ítem');

    // Add new columns if they don't exist
    if (!hasCostCenterColumn) {
      await conn.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN cost_center_id BIGINT UNSIGNED NULL COMMENT 'Centro de costo asociado al ítem' AFTER purchase_order_id
      `);
      console.log('   ✅ Columna cost_center_id añadida');
    }

    if (!hasAccountCategoryColumn) {
      await conn.query(`
        ALTER TABLE purchase_order_items 
        ADD COLUMN account_category_id BIGINT UNSIGNED NULL COMMENT 'Categoría contable del ítem' AFTER cost_center_id
      `);
      console.log('   ✅ Columna account_category_id añadida');
    }

    // Add foreign keys
    if (!hasCostCenterColumn) {
      await conn.query(`
        ALTER TABLE purchase_order_items 
        ADD FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Foreign key a cost_centers añadida');
    }

    if (!hasAccountCategoryColumn) {
      await conn.query(`
        ALTER TABLE purchase_order_items 
        ADD FOREIGN KEY (account_category_id) REFERENCES account_categories(id) ON DELETE SET NULL
      `);
      console.log('   ✅ Foreign key a account_categories añadida');
    }

    // Add indexes for better performance
    if (!hasCostCenterColumn) {
      await conn.query('CREATE INDEX idx_cost_center ON purchase_order_items(cost_center_id)');
      console.log('   ✅ Índice para cost_center_id creado');
    }

    if (!hasAccountCategoryColumn) {
      await conn.query('CREATE INDEX idx_account_category ON purchase_order_items(account_category_id)');
      console.log('   ✅ Índice para account_category_id creado');
    }

    console.log('✅ Tabla purchase_order_items evolucionada exitosamente');
    console.log('🎯 Ahora cada ítem puede tener su propio centro de costo y categoría contable');

  } catch (error) {
    console.error('❌ Error evolucionando purchase_order_items:', error);
    throw error;
  }
}

// Create invoices table (now references cost_centers)
async function createInvoicesTable() {
  try {
    const exists = await checkTableExists('invoices');
    if (exists) {
      console.log('ℹ️ Invoices table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        unique_folio VARCHAR(50) NOT NULL UNIQUE COMMENT 'Unique invoice identifier',
        document_folio VARCHAR(50) COMMENT 'Document folio number',
        invoice_number VARCHAR(50),
        supplier_id BIGINT UNSIGNED,
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        issue_date DATE NOT NULL,
        estimated_payment_date DATE,
        due_date DATE,
        total_amount DECIMAL(15,2) NOT NULL,
        net_amount DECIMAL(15,2),
        tax_amount DECIMAL(15,2),
        document_status ENUM('ingresada', 'aprobada', 'rechazada', 'pagada', 'vencida') DEFAULT 'ingresada',
        payment_status ENUM('no_pagada', 'pago_parcial', 'pagada') DEFAULT 'no_pagada',
        invoice_comments TEXT,
        purchase_order_id BIGINT UNSIGNED NULL,
        tax_service_status VARCHAR(100) COMMENT 'SII status in Chile',
        tax_service_reception_date DATE,
        document_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
        INDEX idx_unique_folio (unique_folio),
        INDEX idx_document_folio (document_folio),
        INDEX idx_issue_date (issue_date),
        INDEX idx_supplier (supplier_id),
        INDEX idx_document_status (document_status),
        INDEX idx_payment_status (payment_status),
        INDEX idx_purchase_order (purchase_order_id),
        INDEX idx_cost_center (cost_center_id)
      )
    `);
    console.log('✅ Invoices table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating invoices table:', error);
    throw error;
  }
}

// Create invoice payments table
async function createInvoicePaymentsTable() {
  try {
    const exists = await checkTableExists('invoice_payments');
    if (exists) {
      console.log('ℹ️ Invoice_payments table already exists');
      return;
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        invoice_id BIGINT UNSIGNED NOT NULL,
        payment_amount DECIMAL(15,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method ENUM('transferencia', 'cheque', 'efectivo', 'tarjeta') DEFAULT 'transferencia',
        transaction_number VARCHAR(100),
        bank VARCHAR(100),
        observations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        INDEX idx_invoice (invoice_id),
        INDEX idx_payment_date (payment_date)
      )
    `);
    console.log('✅ Invoice_payments table created');
  } catch (error) {
    console.error('❌ Error creating invoice_payments table:', error);
    throw error;
  }
}

// ==========================================
// HUMAN RESOURCES TABLES
// ==========================================

// Create social security table (now references cost_centers)
async function createSocialSecurityTable() {
  try {
    const exists = await checkTableExists('social_security');
    if (exists) {
      console.log('ℹ️ Social_security table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS social_security (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        employee_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(100) NOT NULL,
        employee_tax_id VARCHAR(20) NOT NULL COMMENT 'Employee RUT or Tax ID',
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        type ENUM('afp', 'isapre', 'isapre_7', 'seguro_cesantia', 'mutual') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        date DATE NOT NULL,
        period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM format',
        status ENUM('pendiente', 'pagado', 'cancelado') DEFAULT 'pendiente',
        area VARCHAR(100),
        legal_deductions DECIMAL(15,2),
        payment_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Foreign Keys
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX idx_employee_tax_id (employee_tax_id),
        INDEX idx_period (period),
        INDEX idx_date (date),
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_status (status),
        INDEX idx_type (type)
      )
    `);
    console.log('✅ Social_security table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating social_security table:', error);
    throw error;
  }
}

// Create payroll table (now references cost_centers)
async function createPayrollTable() {
  try {
    const exists = await checkTableExists('payroll');
    if (exists) {
      console.log('ℹ️ Payroll table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payroll (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        employee_id BIGINT UNSIGNED NOT NULL,
        employee_name VARCHAR(100) NOT NULL,
        employee_tax_id VARCHAR(20) NOT NULL COMMENT 'Employee RUT or Tax ID',
        employee_position VARCHAR(100),
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        type ENUM('remuneracion', 'anticipo') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        net_salary DECIMAL(15,2) COMMENT 'Net salary after deductions',
        advance_payment DECIMAL(15,2) COMMENT 'Advance payment',
        date DATE NOT NULL,
        period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM format',
        work_days INT DEFAULT 30,
        payment_method ENUM('transferencia', 'cheque', 'efectivo') DEFAULT 'transferencia',
        status ENUM('pendiente', 'aprobado', 'pagado', 'rechazado', 'cancelado') DEFAULT 'pendiente',
        area VARCHAR(100),
        payment_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Foreign Keys
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
        
        -- Indexes
        INDEX idx_employee_tax_id (employee_tax_id),
        INDEX idx_period (period),
        INDEX idx_date (date),
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_status (status)
      )
    `);
    console.log('✅ Payroll table created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating payroll table:', error);
    throw error;
  }
}

// ==========================================
// ACCOUNTING COSTS TABLE (NEW)
// ==========================================

// Create accounting costs table - THE NEW KEY TABLE
async function createAccountingCostsTable() {
  try {
    const exists = await checkTableExists('accounting_costs');
    if (exists) {
      console.log('ℹ️ Accounting_costs table already exists');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS accounting_costs (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        
        -- Main references
        cost_center_id BIGINT UNSIGNED NOT NULL COMMENT 'Associated cost center',
        account_category_id BIGINT UNSIGNED NOT NULL COMMENT 'Accounting account (from the 42)',
        
        -- Cost information
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        date DATE NOT NULL,
        period VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
        
        -- Cost type (CORREGIDO: valores en español)
        cost_type ENUM('real', 'presupuestado', 'estimado') DEFAULT 'real',
        
        -- Optional references to source documents
        invoice_id BIGINT UNSIGNED NULL,
        purchase_order_id BIGINT UNSIGNED NULL,
        social_security_id BIGINT UNSIGNED NULL,
        payroll_id BIGINT UNSIGNED NULL,
        
        -- Additional information
        supplier_id BIGINT UNSIGNED NULL,
        employee_tax_id VARCHAR(20) NULL,
        notes TEXT,
        reference_document VARCHAR(100) NULL,
        
        -- Control
        status ENUM('borrador', 'confirmado', 'cancelado') DEFAULT 'confirmado',
        created_by BIGINT UNSIGNED NULL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Foreign Keys
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id) ON DELETE CASCADE,
        FOREIGN KEY (account_category_id) REFERENCES account_categories(id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
        FOREIGN KEY (social_security_id) REFERENCES social_security(id) ON DELETE SET NULL,
        FOREIGN KEY (payroll_id) REFERENCES payroll(id) ON DELETE SET NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        
        -- Indexes
        INDEX idx_cost_center (cost_center_id),
        INDEX idx_account_category (account_category_id),
        INDEX idx_date (date),
        INDEX idx_period (period),
        INDEX idx_cost_type (cost_type),
        INDEX idx_status (status),
        INDEX idx_invoice (invoice_id),
        INDEX idx_purchase_order (purchase_order_id),
        INDEX idx_employee_tax_id (employee_tax_id),
        INDEX idx_cost_center_account (cost_center_id, account_category_id),
        INDEX idx_period_cost_center (period, cost_center_id)
      )
    `);
    console.log('✅ Accounting_costs table created (KEY SYSTEM TABLE)');
    console.log('   🎯 Relates: Cost Center + Account Category = Individual Cost');
  } catch (error) {
    console.error('❌ Error creating accounting_costs table:', error);
    throw error;
  }
}

// ==========================================
// CONSOLIDATED VIEWS
// ==========================================

// Create main consolidated view
async function createConsolidatedView() {
  try {
    await conn.query('DROP VIEW IF EXISTS consolidated_accounts_view');

    await conn.query(`
      CREATE VIEW consolidated_accounts_view AS
      SELECT 
        po.id as po_id,
        inv.id as invoice_id,
        po.po_number,
        po.po_date,
        po.description as po_description,
  (SELECT COALESCE(SUM(i.total),0) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) as po_amount,
        po.status as po_status,
        
        -- Cost center information (UNIFIED)
        cc.code as center_code,
        cc.name as center_name,
        cc.type as center_type,
        cc.description as center_description,
        cc.client as center_client,
        cc.location as center_location,
        cc.status as center_status,
        
        -- Supplier information
        s.tax_id as supplier_tax_id,
        s.legal_name as supplier_name,
        
        -- Account category information
        ac.code as account_code,
        ac.name as account_name,
        ac.group_name as account_group,
        ac.type as account_type,
        
        -- Invoice information
        inv.unique_folio,
        inv.document_folio,
        inv.invoice_number,
        inv.issue_date,
        inv.estimated_payment_date,
        inv.due_date,
        inv.total_amount as invoice_amount,
        inv.document_status,
        inv.payment_status,
        inv.invoice_comments,
        inv.tax_service_status,
        
        -- Payment information
        COALESCE(pay.total_paid, 0) as amount_paid,
        COALESCE(pay.last_payment, NULL) as last_payment_date,
        
        -- Enhanced calculated fields
        CASE 
          WHEN inv.id IS NOT NULL THEN 'Con Factura'
          ELSE 'Sin Factura'
        END as has_invoice,
        
  COALESCE(inv.total_amount, (SELECT COALESCE(SUM(i.total),0) FROM purchase_order_items i WHERE i.purchase_order_id = po.id)) as effective_amount,
        
        -- General process status
        CASE 
          WHEN inv.payment_status = 'pagada' THEN 'Pagado'
          WHEN inv.document_status = 'aprobada' AND inv.payment_status = 'no_pagada' THEN 'Aprobado - No Pagado'
          WHEN inv.document_status = 'aprobada' AND inv.payment_status = 'pago_parcial' THEN 'Pago Parcial'
          WHEN inv.document_status = 'ingresada' THEN 'Facturado - No Aprobado'
          WHEN po.status = 'activo' AND inv.id IS NULL THEN 'OC Aprobada - Sin Factura'
          WHEN po.status = 'en_progreso' THEN 'OC Enviada'
          ELSE 'borrador'
        END as general_status,
        
        -- Days until due
        CASE 
          WHEN inv.due_date IS NOT NULL THEN 
            DATEDIFF(inv.due_date, CURDATE())
          WHEN inv.estimated_payment_date IS NOT NULL THEN 
            DATEDIFF(inv.estimated_payment_date, CURDATE())
          ELSE NULL
        END as days_until_due,
        
        -- Payment urgency indicator
        CASE 
          WHEN inv.due_date IS NOT NULL AND DATEDIFF(inv.due_date, CURDATE()) < 0 THEN 'Vencido'
          WHEN inv.due_date IS NOT NULL AND DATEDIFF(inv.due_date, CURDATE()) <= 3 THEN 'Urgente'
          WHEN inv.due_date IS NOT NULL AND DATEDIFF(inv.due_date, CURDATE()) <= 7 THEN 'Próximo'
          ELSE 'Normal'
        END as payment_urgency,
        
        -- Classification by center type
        CASE 
          WHEN cc.type = 'proyecto' THEN CONCAT('Proyecto: ', cc.name)
          WHEN cc.type = 'administrativo' THEN CONCAT('Administrativo: ', cc.name)
          WHEN cc.type = 'operacional' THEN CONCAT('Operacional: ', cc.name)
          WHEN cc.type = 'mantenimiento' THEN CONCAT('Mantenimiento: ', cc.name)
          ELSE CONCAT('Otro: ', cc.name)
        END as center_classification,
        
        -- Timestamps
        po.created_at as po_creation_date,
        inv.created_at as invoice_creation_date
        
      FROM purchase_orders po
      LEFT JOIN cost_centers cc ON po.cost_center_id = cc.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN account_categories ac ON po.account_category_id = ac.id
      LEFT JOIN invoices inv ON (inv.purchase_order_id = po.id OR inv.document_folio = po.po_number)
      LEFT JOIN (
        SELECT 
          invoice_id,
          SUM(payment_amount) as total_paid,
          MAX(payment_date) as last_payment
        FROM invoice_payments 
        GROUP BY invoice_id
      ) pay ON inv.id = pay.invoice_id
    `);
    console.log('✅ Consolidated_accounts_view created (→ cost_centers)');
  } catch (error) {
    console.error('❌ Error creating consolidated view:', error);
    throw error;
  }
}

// View of costs by center and account
async function createCostsByCenterView() {
  try {
    await conn.query('DROP VIEW IF EXISTS costs_by_center_view');

    await conn.query(`
      CREATE VIEW costs_by_center_view AS
      SELECT 
        cc.id as cost_center_id,
        cc.code as center_code,
        cc.name as center_name,
        cc.type as center_type,
        cc.status as center_status,
        cc.client as center_client,
        
        ac.id as account_id,
        ac.code as account_code,
        ac.name as account_name,
        ac.type as account_type,
        ac.group_name as account_group,
        
        costs.period,
        COUNT(costs.id) as cost_count,
        SUM(CASE WHEN costs.cost_type = 'real' THEN costs.amount ELSE 0 END) as total_real,
        SUM(CASE WHEN costs.cost_type = 'presupuestado' THEN costs.amount ELSE 0 END) as total_budget,
        SUM(CASE WHEN costs.cost_type = 'estimado' THEN costs.amount ELSE 0 END) as total_estimated,
        SUM(costs.amount) as total_general,
        
        -- Budget deviation analysis
        (SUM(CASE WHEN costs.cost_type = 'real' THEN costs.amount ELSE 0 END) - 
         SUM(CASE WHEN costs.cost_type = 'presupuestado' THEN costs.amount ELSE 0 END)) as budget_deviation,
        
        -- Percentage of center total
        ROUND(
          (SUM(costs.amount) * 100.0) / 
          NULLIF(SUM(SUM(costs.amount)) OVER (PARTITION BY cc.id, costs.period), 0), 2
        ) as center_percentage,
        
        MIN(costs.date) as first_cost_date,
        MAX(costs.date) as last_cost_date,
        MAX(costs.updated_at) as last_update
        
      FROM cost_centers cc
      INNER JOIN accounting_costs costs ON cc.id = costs.cost_center_id
      INNER JOIN account_categories ac ON costs.account_category_id = ac.id
      WHERE costs.status = 'confirmado'
      GROUP BY cc.id, ac.id, costs.period
      ORDER BY cc.code, ac.code, costs.period DESC
    `);
    console.log('✅ Costs_by_center_view created (COST ANALYSIS)');
  } catch (error) {
    console.error('❌ Error creating costs by center view:', error);
    throw error;
  }
}

// ==========================================
// INSERT INITIAL DATA
// ==========================================

// Insert the 42 accounting categories
async function insertAccountCategories() {
  try {
    const [existingCategories] = await conn.query('SELECT COUNT(*) as count FROM account_categories');
    
    if (existingCategories[0].count > 0) {
      console.log('ℹ️ The 42 accounting categories are already configured');
      return;
    }

    await conn.query(`
      INSERT INTO account_categories (code, name, type, group_name) VALUES
      ('1.1', 'MANO DE OBRA DIRECTO', 'mano_obra', 'Mano de Obra'),
      ('1.2', 'MANO DE OBRA INDIRECTO', 'mano_obra', 'Mano de Obra'),
      ('2.1', 'MAQUINARIA DIRECTA', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.2', 'MAQUINARIA DIRECTA MPF', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.3', 'MAQUINARIA INDIRECTA', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.4', 'MAQUINARIA INDIRECTA MPF', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.5', 'FLETES DE MAQUINARIA', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.6', 'HERRAMIENTAS Y EQUIPOS MENORES', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.7', 'MANTENCIÓN VEHÍCULOS, MAQUINARIAS Y EQUIPOS', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.8', 'EQUIPAMIENTO MAQUINARÍA', 'maquinaria', 'Maquinaria y Equipos'),
      ('2.9', 'ELEMENTOS DE DESGASTE', 'maquinaria', 'Maquinaria y Equipos'),
      ('3.1', 'MOVIMIENTO DE TIERRA', 'materiales', 'Materiales'),
      ('3.2', 'MATERIALES OBRAS CIVILES', 'materiales', 'Materiales'),
      ('3.3', 'SEGURIDAD VIAL DEFINITIVA', 'materiales', 'Materiales'),
      ('3.4', 'ASFALTO', 'materiales', 'Materiales'),
      ('3.5', 'SAL', 'materiales', 'Materiales'),
      ('3.6', 'HORMIGÓN', 'materiales', 'Materiales'),
      ('3.7', 'ACERO PARA ARMADURAS', 'materiales', 'Materiales'),
      ('3.8', 'MATERIALES EDIFICACIÓN', 'materiales', 'Materiales'),
      ('3.9', 'MATERIALES ELÉCTRICOS', 'materiales', 'Materiales'),
      ('3.10', 'OTROS MATERIALES', 'materiales', 'Materiales'),
      ('4.1', 'DIÉSEL', 'combustibles', 'Combustibles'),
      ('4.2', 'BENCINA', 'combustibles', 'Combustibles'),
      ('4.3', 'OTROS COMBUSTIBLES', 'combustibles', 'Combustibles'),
      ('5.1', 'ALOJAMIENTOS', 'gastos_generales', 'Gastos Generales'),
      ('5.2', 'ALIMENTACIÓN EN OBRA', 'gastos_generales', 'Gastos Generales'),
      ('5.3', 'MOVILIZACIÓN', 'gastos_generales', 'Gastos Generales'),
      ('5.4', 'SERVICIOS BÁSICOS FAENA', 'gastos_generales', 'Gastos Generales'),
      ('5.5', 'EQUIPAMIENTO INSTALACIÓN FAENA (ACTIVO FIJO)', 'gastos_generales', 'Gastos Generales'),
      ('5.6', 'INSTALACIONES DE FAENA', 'gastos_generales', 'Gastos Generales'),
      ('5.7', 'GASTOS ADMINISTRATIVOS', 'gastos_generales', 'Gastos Generales'),
      ('5.8', 'ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)', 'gastos_generales', 'Gastos Generales'),
      ('5.9', 'SEGURIDAD PROVISORIA', 'gastos_generales', 'Gastos Generales'),
      ('5.10', 'INSUMOS OFICINA', 'gastos_generales', 'Gastos Generales'),
      ('5.11', 'GASTOS TOPOGRAFICOS', 'gastos_generales', 'Gastos Generales'),
      ('5.12', 'GASTOS LABORATORIO', 'gastos_generales', 'Gastos Generales'),
      ('5.13', 'GASTOS ARQUEOLÓGICOS', 'gastos_generales', 'Gastos Generales'),
      ('5.14', 'SERVICIOS SANITARIOS', 'gastos_generales', 'Gastos Generales'),
      ('5.15', 'GASTOS MEDIOAMBIENTALES', 'gastos_generales', 'Gastos Generales'),
      ('5.16', 'ARTICULOS COMPUTACIONALES Y TECNOLÓGICOS', 'gastos_generales', 'Gastos Generales'),
      ('5.17', 'EQUIPOS DE COMUNICACIÓN', 'gastos_generales', 'Gastos Generales'),
      ('5.18', 'ATENCIONES', 'gastos_generales', 'Gastos Generales'),
      ('5.19', 'ESTUDIOS, ASESORIAS Y CONSULTORIAS', 'gastos_generales', 'Gastos Generales'),
      ('5.20', 'CAPACITACIONES Y CERTIFICACIONES', 'gastos_generales', 'Gastos Generales'),
      ('5.21', 'PÓLIZAS Y SEGUROS', 'gastos_generales', 'Gastos Generales'),
      ('5.22', 'GASTOS BANCARIOS Y FINANCIEROS', 'gastos_generales', 'Gastos Generales'),
      ('5.23', 'OFICINA CENTRAL', 'gastos_generales', 'Gastos Generales'),
      ('5.24', 'OTROS GASTOS GENERALES OBRA', 'gastos_generales', 'Gastos Generales'),
      ('5.25', 'GASTOS IMPREVISTOS Y OTROS', 'gastos_generales', 'Gastos Generales')
    `);
    console.log('✅ 42 accounting categories inserted');
  } catch (error) {
    console.error('❌ Error inserting accounting categories:', error);
    throw error;
  }
}

// Insert unified cost centers
async function insertCostCenters() {
  try {
    const [existingCenters] = await conn.query('SELECT COUNT(*) as count FROM cost_centers');
    
    if (existingCenters[0].count > 0) {
      console.log('ℹ️ Cost centers are already configured');
      return;
    }

    await conn.query(`
      INSERT INTO cost_centers (
        code, name, type, description, client, location, status, 
        total_budget, start_date, expected_end_date, department
      ) VALUES
      -- Administrative center
      ('001-0', 'Oficina Central', 'administrativo', 
       'Centro de gestión administrativa y dirección general', 
       'SAER Engineering', 'Valdivia, Los Ríos', 'activo', 
       NULL, NULL, NULL, 'Administración General'),
      
      ('001-3', 'Mina Plata Carina', 'proyecto', 
       'Proyecto minero Plata Carina', 
       'Mina Plata Carina', 'Región de Atacama', 'activo', 
       NULL, '2024-01-01', '2025-12-31', NULL),
       
      ('029', 'Los Guindos', 'proyecto', 
       'Proyecto Los Guindos', 
       'Cliente Los Guindos', 'Región Metropolitana', 'activo', 
       NULL, '2024-01-01', '2025-12-31', NULL),
      
      -- Main construction projects
      ('038', 'Nuevo Cobre', 'proyecto', 
       'Proyecto de construcción vial en sector minero', 
       'CODELCO', 'Región de Antofagasta', 'en_progreso', 
       850000000.00, '2024-03-01', '2025-08-30', NULL),
       
      ('039', 'Caritaya Norte', 'proyecto', 
       'Proyecto de infraestructura vial en zona norte', 
       'Ministerio de Obras Públicas', 'Región de Tarapacá', 'en_progreso', 
       1200000000.00, '2024-05-15', '2025-12-15', NULL),
       
      ('041', 'Cruces Seguridad Vial', 'proyecto', 
       'Proyecto de mejora de seguridad vial en cruces urbanos', 
       'Dirección de Vialidad', 'Múltiples ubicaciones', 'activo', 
       450000000.00, '2024-08-01', '2025-06-30', NULL),
       
      ('042', 'Conservación ruta Lanco', 'proyecto', 
       'Proyecto de conservación bypass Lanco', 
       'Dirección de Vialidad', 'Lanco, Los Ríos', 'en_progreso', 
       320000000.00, '2024-06-01', '2025-10-31', NULL),
       
      -- Operational center
      ('002', 'Mantención de Maquinaria', 'mantenimiento', 
       'Centro de mantención y reparación de maquinaria', 
       'SAER Engineering', 'Valdivia, Los Ríos', 'activo', 
       NULL, NULL, NULL, 'Operaciones')
    `);
    
    // Show assigned IDs for verification
    const [centers] = await conn.query('SELECT id, code, name FROM cost_centers ORDER BY code');
    console.log('\n📋 Cost centers created:');
    centers.forEach(center => {
      console.log(`   ID: ${center.id} | Code: ${center.code} | Name: ${center.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error inserting cost centers:', error);
    throw error;
  }
}

// Insert example suppliers
async function insertSuppliers() {
  try {
    const [existingSuppliers] = await conn.query('SELECT COUNT(*) as count FROM suppliers');
    
    if (existingSuppliers[0].count > 0) {
      console.log('ℹ️ Suppliers are already configured');
      return;
    }

    await conn.query(`
      INSERT INTO suppliers (tax_id, legal_name, commercial_name) VALUES
      ('77715515-6', 'SEPCOR SERVICIOS GENERALES SPA', 'SEPCOR'),
      ('76307553-2', 'BK SPA', 'BK'),
      ('99520000-7', 'COPEC SA', 'COPEC'),
      ('92475000-6', 'KAUFMANN S A VEHICULOS AUTOMOTORES', 'KAUFMANN'),
      ('76524185-5', 'EL ARENAL COMERCIAL LIMITADA', 'EL ARENAL'),
      ('96878380-7', 'CHILEMAQ', 'CHILEMAQ'),
      ('78924030-2', 'IMPLEMENTOS S.A.', 'IMPLEMENTOS'),
      ('76154515-9', 'BITUMIX AUSTRAL S.A.', 'BITUMIX'),
      ('14282432-9', 'EVELYN DEL CARMEN PLACENCIO CATALAN', 'EVELYN PLACENCIO'),
      ('76098819-7', 'GLOBALSAT CHILE', 'GLOBALSAT'),
      ('90146000-0', 'PROGRESS SERVICIOS FINANCIEROS S.A.', 'PROGRESS'),
      ('99147000-K', 'BCI SEGUROS GENERALES S A', 'BCI SEGUROS')
    `);
    console.log('✅ Example suppliers inserted');
  } catch (error) {
    console.error('❌ Error inserting suppliers:', error);
    throw error;
  }
}

// Insert initial cash flow categories
async function insertInitialCategories() {
  try {
    const [existingCategories] = await conn.query('SELECT COUNT(*) as count FROM cash_flow_categories');
    
    if (existingCategories[0].count > 0) {
      console.log('ℹ️ Cash flow categories are already configured');
      return;
    }
    
    await conn.query(`
      INSERT INTO cash_flow_categories (name, type) VALUES 
      ('Pago de Hito', 'ingreso'),
      ('Mano de Obra', 'gasto'),
      ('Materiales', 'gasto'),
      ('Equipamiento', 'gasto'),
      ('Subcontratistas', 'gasto'),
      ('Pago Anticipado', 'ingreso'),
      ('Permisos y Licencias', 'gasto')
    `);
    console.log('✅ Cash flow categories inserted');
  } catch (error) {
    console.error('❌ Error inserting initial categories:', error);
    throw error;
  }
}

// Create initial admin user
async function createAdminUser() {
  try {
    const [existingUsers] = await conn.query(
      'SELECT COUNT(*) as count FROM users WHERE email = ?', 
      ['admin@saer.cl']
    );
    
    if (existingUsers[0].count > 0) {
      console.log('ℹ️ Admin user already exists');
      return;
    }
    
    const hashedPassword = await bcrypt.hash('admin', 10);
    await conn.query(`
      INSERT INTO users (name, email, password, role, position, location, address) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['Administrador', 'admin@saer.cl', hashedPassword, 'admin', 'Administrador del Sistema', 'Oficina Central', null]);
    
    console.log('✅ Admin user created:');
    console.log('   Email: admin@saer.cl');
    console.log('   Password: admin');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Create additional indexes for performance
async function createAdditionalIndexes() {
  try {
    console.log('🔄 Creating additional indexes for optimization...');
    
    const indexes = [
      { name: 'idx_po_date_status', table: 'purchase_orders', columns: '(po_date, status)' },
      { name: 'idx_invoice_date_status', table: 'invoices', columns: '(issue_date, document_status)' },
      { name: 'idx_account_group_code', table: 'account_categories', columns: '(group_name, code)' },
      { name: 'idx_invoice_due_date', table: 'invoices', columns: '(due_date, payment_status)' },
      { name: 'idx_cost_center_type', table: 'cost_centers', columns: '(type, status)' },
      { name: 'idx_costs_period_center', table: 'accounting_costs', columns: '(period, cost_center_id)' }
    ];

    for (const index of indexes) {
      try {
        await conn.query(`CREATE INDEX ${index.name} ON ${index.table}${index.columns}`);
        console.log(`   ✅ Índice ${index.name} creado en ${index.table}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`   ℹ️ Índice ${index.name} ya existe en ${index.table}`);
        } else {
          console.error(`   ❌ Error creando índice ${index.name}:`, error.message);
        }
      }
    }
    
    console.log('✅ Additional indexes creation process completed');
  } catch (error) {
    console.error('❌ Error creating additional indexes:', error);
  }
}

// Insert some example accounting costs (CORREGIDO)
async function insertAccountingCostsExample() {
  try {
    const [existingCosts] = await conn.query('SELECT COUNT(*) as count FROM accounting_costs');
    
    if (existingCosts[0].count > 0) {
      console.log('ℹ️ Example accounting costs are already configured');
      return;
    }

    // Get cost center and account IDs
    const [centers] = await conn.query('SELECT id, code FROM cost_centers WHERE type = "proyecto" LIMIT 2');
    const [accounts] = await conn.query('SELECT id, code FROM account_categories LIMIT 5');
    
    if (centers.length > 0 && accounts.length > 0) {
      const center1 = centers[0].id;
      const center2 = centers[1]?.id || center1;
      
      await conn.query(`
        INSERT INTO accounting_costs (
          cost_center_id, account_category_id, description, amount, date, period, cost_type
        ) VALUES
        (?, ?, 'Compra de materiales de construcción', 2500000.00, '2024-06-15', '2024-06', 'real'),
        (?, ?, 'Pago sueldo equipo técnico', 3200000.00, '2024-06-30', '2024-06', 'real'),
        (?, ?, 'Arriendo maquinaria pesada', 1800000.00, '2024-06-20', '2024-06', 'real'),
        (?, ?, 'Combustible maquinaria', 950000.00, '2024-06-25', '2024-06', 'real'),
        (?, ?, 'Gastos administrativos proyecto', 450000.00, '2024-06-28', '2024-06', 'real')
      `, [
        center1, accounts[0].id,
        center1, accounts[1].id, 
        center2, accounts[2].id,
        center2, accounts[3].id,
        center1, accounts[4].id
      ]);
      
      console.log('✅ Example accounting costs inserted');
      console.log(`   💰 5 costs distributed between centers ${centers[0].code} and ${centers[1]?.code || centers[0].code}`);
    }
  } catch (error) {
    console.error('❌ Error inserting example accounting costs:', error);
  }
}

// Optional function to confirm destructive actions
async function confirmDestructiveAction() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️ Are you sure you want to delete the database? (type "CONFIRM"): ', (answer) => {
      rl.close();
      resolve(answer === 'CONFIRM');
    });
  });
}

// Main setup function
async function setup() {
  const force = process.argv.includes('--force');
  const skipConfirmation = process.argv.includes('--yes');
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const connected = await initializeConnection();
    if (!connected) {
      process.exit(1);
    }

    if (force) {
      console.log('⚠️ --force flag detected: This action will delete ALL existing data.');
      
      if (!isDev && !skipConfirmation) {
        const confirmed = await confirmDestructiveAction();
        if (!confirmed) {
          console.log('❌ Operation cancelled by user');
          process.exit(0);
        }
      }
      
      if (!isDev) {
        console.log('⏳ Waiting 3 seconds before proceeding...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      await destroyDatabase();
      console.log('✅ Database deleted. Creating new database...');
    }

    await createDatabase();

    // ==========================================
    // STEP 1: CREATE BASE TABLES (correct order for foreign keys)
    // ==========================================
    console.log('\n🏗️ Step 1: Creating base tables...');
    
    await createUsersTable(); // WITHOUT foreign keys yet
    await createCostCentersTable(); // MAIN TABLE
    await createClientsTable();
    
    // ==========================================
    // STEP 2: ADD CROSS FOREIGN KEYS
    // ==========================================
    console.log('\n🔗 Step 2: Establishing relationships between users and cost_centers...');
    
    await addUsersForeignKeys();
    await addCostCentersForeignKeys();
    
    // ==========================================
    // STEP 3: CREATE DEPENDENT TABLES
    // ==========================================
    console.log('\n🏗️ Step 3: Creating dependent tables...');
    
    await createMilestonesTable();
    await createCashFlowCategoriesTable();
    await createCashFlowLinesTable();
    
    // ==========================================
    // STEP 4: ACCOUNTING SYSTEM
    // ==========================================
    console.log('\n🏗️ Step 4: Creating accounting system...');
    
    await createAccountCategoriesTable();
    await createSuppliersTable();
    await createPurchaseOrdersTable();
    await createPurchaseOrderItemsTable();
    await createInvoicesTable();
    await createInvoicePaymentsTable();
    await createFixedCostsTable();

    
    // ==========================================
    // STEP 5: HUMAN RESOURCES
    // ==========================================
    console.log('\n🏗️ Step 5: Creating human resources tables...');
    
    await createSocialSecurityTable();
    await createPayrollTable();
    
    // ==========================================
    // STEP 6: CENTRAL ACCOUNTING COSTS TABLE
    // ==========================================
    console.log('\n🏗️ Step 6: Creating central accounting costs table...');
    
    await createAccountingCostsTable(); // KEY TABLE
    
    // ==========================================
    // STEP 7: VIEWS
    // ==========================================
    console.log('\n🏗️ Step 7: Creating consolidated views...');
    
    await createConsolidatedView();
    await createCostsByCenterView();
    
    // ==========================================
    // STEP 8: INITIAL DATA
    // ==========================================
    console.log('\n📝 Step 8: Inserting initial data...');
    
    await insertInitialCategories();
    await createAdminUser();
    await insertAccountCategories();
    await insertCostCenters();
    await insertSuppliers();
    await insertAccountingCostsExample();
    await insertClients();
    await insertFixedCostsTestData();
    // ==========================================
    // STEP 9: OPTIMIZATION
    // ==========================================
    console.log('\n⚡ Step 9: Creating optimization indexes...');
    
    await createAdditionalIndexes();

    console.log('\n✅ SETUP COMPLETED SUCCESSFULLY');
    console.log('\n🎯 KEY CHANGES IMPLEMENTED:');
    console.log('   ✅ All ENUM values changed to Spanish');
    console.log('   ✅ cost_type corrected: real, presupuestado, estimado');
    console.log('   ✅ Table/column names remain in English');
    console.log('   ✅ Only user roles keep English: admin, manager, user');
    console.log('   ✅ All VARCHAR status fields changed to ENUM with Spanish values');

    await implementHito1Simplified(empleadosFake);
    
    await showSchemaStatus();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

// Function to show schema status summary
async function showSchemaStatus() {
  try {
    console.log('\n📊 SCHEMA STATUS:');
    
    // Count records in main tables
    const tables = [
      'cost_centers',
      'account_categories', 
      'accounting_costs',
      'purchase_orders',
  'purchase_order_items',
      'invoices',
      'suppliers',
      'users'
    ];
    
    for (const table of tables) {
      try {
        const [rows] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   📄 ${table}: ${rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table}: Error counting records`);
      }
    }
    
    // Verify foreign keys
    console.log('\n🔗 MAIN FOREIGN KEYS:');
    console.log('   ✅ users.default_cost_center_id → cost_centers.id');
    console.log('   ✅ purchase_orders.cost_center_id → cost_centers.id');
    console.log('   ✅ invoices.cost_center_id → cost_centers.id');
    console.log('   ✅ accounting_costs.cost_center_id → cost_centers.id');
    console.log('   ✅ accounting_costs.account_category_id → account_categories.id');
    console.log('   ✅ social_security.cost_center_id → cost_centers.id');
    console.log('   ✅ payroll.cost_center_id → cost_centers.id');
    
  } catch (error) {
    console.error('Error showing schema status:', error);
  }
}

// Execute setup
setup();