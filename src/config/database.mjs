// src/config/database.mjs
import mysql from 'mysql2/promise';
import config from './config.mjs';

// Registrar intentos de conexión
console.log('Intentando conectar a la base de datos:');
console.log({
  host: config.db.host,
  user: config.db.user,
  database: config.db.database,
  port: config.db.port,
  passwordProvided: !!config.db.password
});

// Crear un pool de conexiones
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,  // Asegurarnos de usar la propiedad correcta
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0
});

// Probar la conexión con un query simple como en tu configuración funcional
const testConnection = async () => {
  try {
    // Usar la misma técnica que en tu proyecto funcional
    const [result] = await pool.query('SELECT 1 as connection_test');
    console.log('✅ Conexión a la base de datos establecida correctamente');
    console.log(`Resultado de prueba: ${result[0].connection_test}`);
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:');
    console.error(`Código: ${error.code}, Estado SQL: ${error.sqlState}`);
    console.error(`Mensaje: ${error.message}`);
    
    // Sugerencias específicas según el error
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
      console.error('\nSugerencias para resolver el problema:');
      console.error('1. Verifica que las credenciales en .env sean correctas');
      console.error('2. Intenta cambiar el método de autenticación de MySQL:');
      console.error('   ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'tu_contraseña\';');
      console.error('   FLUSH PRIVILEGES;');
      console.error('3. O crea un usuario específico para la aplicación:');
      console.error('   CREATE USER \'constructflow\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'tu_contraseña\';');
      console.error('   GRANT ALL PRIVILEGES ON constructflow.* TO \'constructflow\'@\'localhost\';');
      console.error('   FLUSH PRIVILEGES;');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\nLa base de datos no existe. Crea la base de datos con:');
      console.error(`CREATE DATABASE IF NOT EXISTS ${config.db.database};`);
    }
    
    return false;
  }
};

export { pool, testConnection };