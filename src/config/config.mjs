// src/config/config.mjs
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

// Registrar configuración para depuración
console.log('Cargando configuración de base de datos:');
console.log({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    // Usar DB_PASS como en tu proyecto funcional
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'constructflow',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  }
};

export default config;