import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import config from '../src/config/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let conn;

// Inicializar conexión sin especificar una base de datos
async function initializeConnection() {
  console.log('Intentando conectar con:', {
    host: config.db.host,
    user: config.db.user,
    // No mostramos la contraseña por seguridad
    passwordProvided: !!config.db.password
  });

  try {
    // Conectamos solo al servidor MySQL, sin especificar base de datos
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password
    });

    console.log('✅ Conexión al servidor MySQL establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a MySQL:', {
      message: error.message,
      code: error.code,
      errno: error.errno
    });
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
      console.error('\nSugerencias para resolver el problema:');
      console.error('1. Verifica que las credenciales en .env sean correctas');
      console.error('2. Intenta cambiar el método de autenticación de MySQL:');
      console.error('   ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'tu_contraseña\';');
      console.error('   FLUSH PRIVILEGES;');
    }
    
    return false;
  }
}

// Verificar si la base de datos existe
async function checkDatabaseExists() {
  const [rows] = await conn.query(
    'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
    [config.db.database]
  );
  return rows.length > 0;
}

// Verificar si una tabla existe
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

// Verificar si una columna existe en una tabla
async function checkColumnExists(tableName, columnName) {
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [config.db.database, tableName, columnName]
    );
    return rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Eliminar la base de datos si existe
async function destroyDatabase() {
  try {
    await conn.query(`DROP DATABASE IF EXISTS ${config.db.database}`);
    console.log(`Base de datos ${config.db.database} eliminada`);
  } catch (error) {
    // Ignorar: Falla si la base de datos no existe
  }
}

// Crear la base de datos si no existe
async function createDatabase() {
  try {
    const exists = await checkDatabaseExists();
    if (!exists) {
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database} 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ Base de datos ${config.db.database} creada`);
    } else {
      console.log(`ℹ️ Base de datos ${config.db.database} ya existe`);
    }

    // Cambiar a la base de datos
    await conn.query(`USE ${config.db.database}`);
  } catch (error) {
    console.error('❌ Error al crear base de datos:', error);
    throw error;
  }
}

// Crear tabla de usuarios
async function createUsersTable() {
  try {
    const exists = await checkTableExists('users');
    if (exists) {
      console.log('ℹ️ Tabla users ya existe');
      
      // Verificar y añadir campos de compañía si no existen
      const companyIdExists = await checkColumnExists('users', 'company_id');
      if (!companyIdExists) {
        await conn.query(`ALTER TABLE users ADD COLUMN company_id BIGINT UNSIGNED`);
        await conn.query(`CREATE INDEX idx_users_company ON users(company_id)`);
        console.log('✅ Campo company_id añadido a la tabla users');
      }
      
      const positionExists = await checkColumnExists('users', 'position');
      if (!positionExists) {
        await conn.query(`ALTER TABLE users ADD COLUMN position VARCHAR(100)`);
        console.log('✅ Campo position añadido a la tabla users');
      }
      
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role ENUM('admin', 'manager', 'user') DEFAULT 'user',
        company_id BIGINT UNSIGNED,
        position VARCHAR(100),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_company (company_id)
      )
    `);
    console.log('✅ Tabla users creada');
  } catch (error) {
    console.error('❌ Error al crear tabla users:', error);
    throw error;
  }
}

// Crear tabla de proyectos
async function createProjectsTable() {
  try {
    const exists = await checkTableExists('construction_projects');
    if (exists) {
      console.log('ℹ️ Tabla construction_projects ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS construction_projects (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        owner_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        client_id BIGINT UNSIGNED,
        status ENUM('draft', 'in_progress', 'completed', 'cancelled') DEFAULT 'draft',
        start_date DATE,
        expected_end_date DATE,
        actual_end_date DATE,
        total_budget DECIMAL(15,2),
        description TEXT,
        location VARCHAR(255),
        location_lat DOUBLE,
        location_lon DOUBLE,
        currency_id INT UNSIGNED DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Tabla construction_projects creada');
    
    // Añadir relación de llave foránea para company_id en users
    await conn.query(`
      ALTER TABLE users 
      ADD CONSTRAINT fk_user_company 
      FOREIGN KEY (company_id) REFERENCES construction_projects(id)
    `);
    console.log('✅ Relación entre users y construction_projects establecida');
  } catch (error) {
    console.error('❌ Error al crear tabla construction_projects:', error);
    throw error;
  }
}

// Crear tabla de hitos
async function createMilestonesTable() {
  try {
    const exists = await checkTableExists('construction_milestones');
    if (exists) {
      console.log('ℹ️ Tabla construction_milestones ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS construction_milestones (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        project_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        planned_date DATE NOT NULL,
        actual_date DATE,
        amount DECIMAL(15,2),
        weight DECIMAL(5,2) DEFAULT 10.00,
        is_completed BOOLEAN DEFAULT FALSE,
        sequence INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES construction_projects(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla construction_milestones creada');
  } catch (error) {
    console.error('❌ Error al crear tabla construction_milestones:', error);
    throw error;
  }
}

// Crear tabla de categorías de flujo de caja
async function createCashFlowCategoriesTable() {
  try {
    const exists = await checkTableExists('cash_flow_categories');
    if (exists) {
      console.log('ℹ️ Tabla cash_flow_categories ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_flow_categories (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        type ENUM('income', 'expense', 'both') DEFAULT 'both',
        parent_id BIGINT UNSIGNED,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES cash_flow_categories(id)
      )
    `);
    console.log('✅ Tabla cash_flow_categories creada');
  } catch (error) {
    console.error('❌ Error al crear tabla cash_flow_categories:', error);
    throw error;
  }
}

// Crear tabla de líneas de flujo de caja
async function createCashFlowLinesTable() {
  try {
    const exists = await checkTableExists('cash_flow_lines');
    if (exists) {
      console.log('ℹ️ Tabla cash_flow_lines ya existe');
      return;
    }
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_flow_lines (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        project_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(255) NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        planned_date DATE NOT NULL,
        actual_date DATE,
        amount DECIMAL(15,2) NOT NULL,
        state ENUM('forecast', 'actual') DEFAULT 'forecast',
        partner_id BIGINT UNSIGNED,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES construction_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES cash_flow_categories(id)
      )
    `);
    console.log('✅ Tabla cash_flow_lines creada');
  } catch (error) {
    console.error('❌ Error al crear tabla cash_flow_lines:', error);
    throw error;
  }
}

// Insertar categorías iniciales
async function insertInitialCategories() {
  try {
    // Verificar si ya hay categorías
    const [existingCategories] = await conn.query('SELECT COUNT(*) as count FROM cash_flow_categories');
    
    if (existingCategories[0].count > 0) {
      console.log('ℹ️ Las categorías de flujo de caja ya están configuradas');
      return;
    }
    
    // Insertar categorías iniciales
    await conn.query(`
      INSERT INTO cash_flow_categories (name, type) VALUES 
      ('Pago de Hito', 'income'),
      ('Mano de Obra', 'expense'),
      ('Materiales', 'expense'),
      ('Equipamiento', 'expense'),
      ('Subcontratistas', 'expense'),
      ('Pago Anticipado', 'income'),
      ('Permisos y Licencias', 'expense')
    `);
    console.log('✅ Categorías iniciales insertadas');
  } catch (error) {
    console.error('❌ Error al insertar categorías iniciales:', error);
    throw error;
  }
}

// Crear usuario administrador inicial
async function createAdminUser() {
  try {
    // Verificar si ya existe el usuario admin
    const [existingUsers] = await conn.query(
      'SELECT COUNT(*) as count FROM users WHERE email = ?', 
      ['admin@saer.cl']
    );
    
    if (existingUsers[0].count > 0) {
      console.log('ℹ️ Usuario administrador ya existe');
      return;
    }
    
    // Crear usuario administrador
    const hashedPassword = await bcrypt.hash('admin', 10);
    await conn.query(`
      INSERT INTO users (name, email, password, role) 
      VALUES (?, ?, ?, ?)
    `, ['Administrador', 'admin@saer.cl', hashedPassword, 'admin']);
    
    console.log('✅ Usuario administrador creado:');
    console.log('   Email: admin@saer.cl');
    console.log('   Contraseña: admin');
  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error);
    throw error;
  }
}

// Función principal de configuración
async function setup() {
  const force = process.argv.includes('--force');
  const isDev = process.env.NODE_ENV === 'development';

  try {
    // Inicializar conexión
    const connected = await initializeConnection();
    if (!connected) {
      process.exit(1);
    }

    // Recrear la base de datos si se solicita
    if (force) {
      console.log('⚠️ Recreando la base de datos (--force)...');
      await destroyDatabase();
    }

    // Crear o usar la base de datos
    await createDatabase();

    // Crear tablas
    await createUsersTable();
    await createProjectsTable();
    await createMilestonesTable();
    await createCashFlowCategoriesTable();
    await createCashFlowLinesTable();

    // Insertar datos iniciales
    await insertInitialCategories();
    await createAdminUser();

    console.log('\n✅ Configuración de la base de datos completada exitosamente');
    console.log('\nPuedes iniciar la aplicación con: npm run dev');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante la configuración:', error);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

// Ejecutar configuración
setup();