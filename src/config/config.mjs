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
  },
  // ✅ NUEVA CONFIGURACIÓN PARA CLAUDE
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', // ✅ MODELO CORRECTO
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '2500', 10),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.3'),
    // Configuración de rate limiting básica
    dailyLimit: parseInt(process.env.BUDGET_ANALYSIS_DAILY_LIMIT || '10', 10)
  }
};

// ✅ VALIDACIÓN DE CONFIGURACIÓN CRÍTICA
if (config.server.env === 'production') {
  const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missingVars);
    process.exit(1);
  }
}

// ✅ LOG DE CONFIGURACIÓN ANTHROPIC (sin exponer API key)
console.log('Configuración Anthropic:', {
  configured: !!config.anthropic.apiKey,
  model: config.anthropic.model,
  maxTokens: config.anthropic.maxTokens,
  dailyLimit: config.anthropic.dailyLimit
});

export default config;