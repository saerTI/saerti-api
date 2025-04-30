// scripts/seedAdmin.mjs
import bcrypt from 'bcrypt';
import { pool, testConnection } from '../src/config/database.mjs';

/**
 * Script para crear un usuario administrador inicial
 * Uso: node scripts/seedAdmin.mjs
 */
async function seedAdmin() {
  try {
    console.log('Iniciando creación de usuario administrador...');
    
    // Verificar conexión a la base de datos
    const connected = await testConnection();
    if (!connected) {
      console.error('No se pudo conectar a la base de datos');
      process.exit(1);
    }
    
    const adminData = {
      name: 'Admin SAER',
      email: 'felipeslzar@gmail.com',
      password: '1234',
      role: 'admin'
    };
    
    // Consultar si ya existe un usuario con ese email
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [adminData.email]
    );
    
    if (existingUsers.length > 0) {
      console.log('El usuario administrador ya existe:', existingUsers[0].email);
      console.log('ID:', existingUsers[0].id);
    } else {
      // Encriptar la contraseña
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      
      // Insertar el usuario administrador
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [adminData.name, adminData.email, hashedPassword, adminData.role]
      );
      
      console.log('Usuario administrador creado exitosamente:');
      console.log('Email:', adminData.email);
      console.log('Contraseña:', adminData.password);
      console.log('ID:', result.insertId);
    }
    
    // Cerrar la conexión al terminar
    await pool.end();
    console.log('Proceso completado.');
  } catch (error) {
    console.error('Error al crear usuario administrador:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Ejecutar función
seedAdmin();