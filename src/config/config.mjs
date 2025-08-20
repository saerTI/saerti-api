// src/config/config.mjs - VERSIÓN CORREGIDA
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../..', '.env') });

// Registrar configuración para depuración
console.log('🔧 Cargando configuración de base de datos:');
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
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'constructflow',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  // ✅ CONFIGURACIÓN ANTHROPIC CORREGIDA
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // 🔥 MODELO CORREGIDO - Usar Claude 3.5 Sonnet (más estable)
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000', 10), // Aumentado
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.2'), // Más consistente
    // Rate limiting
    dailyLimit: parseInt(process.env.BUDGET_ANALYSIS_DAILY_LIMIT || '10', 10),
    // Timeouts
    requestTimeout: parseInt(process.env.CLAUDE_TIMEOUT || '60000', 10), // 60 segundos
    retryAttempts: parseInt(process.env.CLAUDE_RETRIES || '2', 10)
  }
};

// ✅ VALIDACIÓN DE CONFIGURACIÓN CRÍTICA
if (config.server.env === 'production') {
  const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missingVars);
    process.exit(1);
  }
}

// ✅ VALIDACIÓN ESPECÍFICA DE ANTHROPIC
if (!config.anthropic.apiKey) {
  console.error('❌ ANTHROPIC_API_KEY no configurada');
  if (config.server.env === 'production') {
    process.exit(1);
  }
} else {
  console.log('✅ Anthropic API Key configurada');
}

// ✅ LOG DE CONFIGURACIÓN ANTHROPIC (sin exponer API key)
console.log('🤖 Configuración Anthropic:', {
  configured: !!config.anthropic.apiKey,
  model: config.anthropic.model,
  maxTokens: config.anthropic.maxTokens,
  temperature: config.anthropic.temperature,
  dailyLimit: config.anthropic.dailyLimit,
  timeout: config.anthropic.requestTimeout
});

// ✅ FUNCIÓN PARA VALIDAR MODELO
export function validateAnthropicModel(model) {
  const validModels = [
    'claude-sonnet-4-20250514',
    'claude-3-haiku-20240307', 
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ];
  
  if (!validModels.includes(model)) {
    console.warn(`⚠️ Modelo ${model} no reconocido. Modelos válidos:`, validModels);
    return false;
  }
  
  return true;
}

// Validar modelo al cargar configuración
validateAnthropicModel(config.anthropic.model);

export default config;