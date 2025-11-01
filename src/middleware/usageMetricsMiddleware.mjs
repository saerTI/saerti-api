// src/middleware/usageMetricsMiddleware.mjs

/**
 * 🎯 MIDDLEWARE DE MÉTRICAS DE USO CONFIGURABLE
 * 
 * Sistema flexible para rastrear el uso de diferentes servicios con métricas específicas.
 * Compatible con autenticación JWT y Clerk.
 * 
 * Servicios Soportados:
 * - Budget Analyzer: Análisis de presupuestos
 * - Cash Flow: Gestión financiera
 */

import { pool } from '../config/database.mjs';

// ============================================================================
// 📊 CONFIGURACIÓN DE SERVICIOS Y MÉTRICAS
// ============================================================================

const SERVICE_CONFIGS = {
  // Budget Analyzer - Métricas simples de conteo
  'budget-analyzer': {
    name: 'Budget Analyzer',
    metrics: {
      daily_analyses: {
        limit: 10,        // Análisis por día (free tier)
        reset: 'daily'
      },
      monthly_analyses: {
        limit: 50,        // Análisis por mes (free tier)
        reset: 'monthly'
      }
    },
    tiers: {
      free: {
        daily_analyses: 10,
        monthly_analyses: 50,
        features: ['basic_analysis', 'pdf_upload']
      },
      pro: {
        daily_analyses: 50,
        monthly_analyses: 500,
        features: ['basic_analysis', 'pdf_upload', 'comparisons', 'advanced_insights']
      },
      enterprise: {
        daily_analyses: -1,  // Ilimitado
        monthly_analyses: -1,
        features: ['all']
      }
    }
  },

  // Cash Flow - Métricas con modelo freemium
  'cash-flow': {
    name: 'Cash Flow Manager',
    metrics: {
      transactions: {
        limit: 100,       // Transacciones por mes (free tier)
        reset: 'monthly'
      },
      organizations: {
        limit: 1,         // Organizaciones (free tier)
        reset: 'never'
      },
      export_reports: {
        limit: 5,         // Exportaciones por mes (free tier)
        reset: 'monthly'
      },
      advanced_projections: {
        limit: 3,         // Proyecciones IA por mes (free tier)
        reset: 'monthly'
      }
    },
    tiers: {
      free: {
        transactions: 100,
        organizations: 1,
        export_reports: 5,
        advanced_projections: 3,
        features: ['basic_cashflow', 'manual_entry', 'basic_reports'],
        restrictions: {
          max_months_history: 3,
          categories_limit: 10
        }
      },
      starter: {
        transactions: 500,
        organizations: 3,
        export_reports: 50,
        advanced_projections: 20,
        price_monthly: 9990,  // CLP
        features: ['basic_cashflow', 'manual_entry', 'basic_reports', 'excel_export', 'basic_projections'],
        restrictions: {
          max_months_history: 12,
          categories_limit: 30
        }
      },
      professional: {
        transactions: 2000,
        organizations: 10,
        export_reports: -1,  // Ilimitado
        advanced_projections: 100,
        price_monthly: 29990,  // CLP
        features: [
          'basic_cashflow', 'manual_entry', 'basic_reports', 
          'excel_export', 'pdf_export', 'advanced_projections',
          'ai_insights', 'multi_currency', 'api_access'
        ],
        restrictions: {
          max_months_history: 36,
          categories_limit: -1
        }
      },
      enterprise: {
        transactions: -1,
        organizations: -1,
        export_reports: -1,
        advanced_projections: -1,
        price_custom: true,
        features: ['all'],
        restrictions: {}
      }
    }
  }
};

// ============================================================================
// 💾 CACHE EN MEMORIA
// ============================================================================

class UsageCache {
  constructor() {
    this.cache = new Map();
    this.lastCleanup = Date.now();
  }

  getKey(userId, service, period) {
    return `${userId}-${service}-${period}`;
  }

  get(userId, service, period) {
    return this.cache.get(this.getKey(userId, service, period));
  }

  set(userId, service, period, data) {
    this.cache.set(this.getKey(userId, service, period), {
      ...data,
      lastUpdated: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    for (const [key, value] of this.cache.entries()) {
      if (now - value.lastUpdated > CACHE_TTL) {
        this.cache.delete(key);
      }
    }

    this.lastCleanup = now;
    console.log('🧹 Cache de métricas limpiado');
  }
}

const usageCache = new UsageCache();

// Cleanup automático cada 10 minutos
setInterval(() => usageCache.cleanup(), 10 * 60 * 1000);

// ============================================================================
// 🗄️ FUNCIONES DE BASE DE DATOS
// ============================================================================

/**
 * Obtener el tier del usuario para un servicio específico
 */
async function getUserTier(userId, service) {
  try {
    const [rows] = await pool.query(
      `SELECT tier FROM user_service_subscriptions 
       WHERE user_id = ? AND service = ? AND active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, service]
    );

    return rows.length > 0 ? rows[0].tier : 'free';
  } catch (error) {
    console.error('Error obteniendo tier de usuario:', error);
    return 'free';
  }
}

/**
 * Obtener el uso actual del usuario
 */
async function getUserUsage(userId, service, period) {
  const cached = usageCache.get(userId, service, period);
  if (cached) {
    return cached;
  }

  try {
    const [rows] = await pool.query(
      `SELECT metric_name, metric_value, period, last_reset
       FROM user_service_metrics
       WHERE user_id = ? AND service = ? AND period = ?`,
      [userId, service, period]
    );

    const usage = {};
    rows.forEach(row => {
      usage[row.metric_name] = {
        value: row.metric_value,
        last_reset: row.last_reset
      };
    });

    usageCache.set(userId, service, period, usage);
    return usage;
  } catch (error) {
    console.error('Error obteniendo uso de usuario:', error);
    return {};
  }
}

/**
 * Incrementar una métrica específica
 */
async function incrementMetric(userId, service, metricName, period, incrementBy = 1) {
  try {
    const now = new Date();
    
    await pool.query(
      `INSERT INTO user_service_metrics 
       (user_id, service, metric_name, metric_value, period, last_reset, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         metric_value = metric_value + ?,
         updated_at = ?`,
      [userId, service, metricName, incrementBy, period, now, now, incrementBy, now]
    );

    // Invalidar cache
    usageCache.cache.delete(usageCache.getKey(userId, service, period));

    console.log(`✅ Métrica incrementada: ${service}.${metricName} = +${incrementBy} (user ${userId})`);
  } catch (error) {
    console.error('Error incrementando métrica:', error);
    throw error;
  }
}

/**
 * Resetear métricas que necesitan reset
 */
async function resetMetricsIfNeeded(userId, service) {
  try {
    const config = SERVICE_CONFIGS[service];
    if (!config) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const [metricName, metricConfig] of Object.entries(config.metrics)) {
      if (metricConfig.reset === 'daily') {
        await pool.query(
          `UPDATE user_service_metrics
           SET metric_value = 0, last_reset = ?
           WHERE user_id = ? AND service = ? AND metric_name = ?
             AND DATE(last_reset) < ?`,
          [now, userId, service, metricName, today]
        );
      } else if (metricConfig.reset === 'monthly') {
        await pool.query(
          `UPDATE user_service_metrics
           SET metric_value = 0, last_reset = ?
           WHERE user_id = ? AND service = ? AND metric_name = ?
             AND DATE_FORMAT(last_reset, '%Y-%m') < ?`,
          [now, userId, service, metricName, currentMonth]
        );
      }
    }
  } catch (error) {
    console.error('Error reseteando métricas:', error);
  }
}

/**
 * Crear suscripción por defecto si no existe
 */
async function ensureSubscription(userId, clerkUserId, service) {
  try {
    const [existing] = await pool.query(
      'SELECT id FROM user_service_subscriptions WHERE user_id = ? AND service = ?',
      [userId, service]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO user_service_subscriptions 
         (user_id, clerk_user_id, service, tier, active, payment_status)
         VALUES (?, ?, ?, 'free', TRUE, 'trial')`,
        [userId, clerkUserId, service]
      );
      console.log(`✅ Suscripción ${service} creada para usuario ${userId} (tier: free)`);
    }
  } catch (error) {
    console.error('Error creando suscripción por defecto:', error);
  }
}

// ============================================================================
// 🛡️ MIDDLEWARE PRINCIPAL
// ============================================================================

/**
 * Middleware configurable de métricas de uso
 * 
 * @param {string} service - 'budget-analyzer' o 'cash-flow'
 * @param {string} metricName - Nombre de la métrica a incrementar
 * @param {object} options - Opciones adicionales
 */
export const trackUsage = (service, metricName, options = {}) => {
  return async (req, res, next) => {
    try {
      // Validar servicio
      const config = SERVICE_CONFIGS[service];
      if (!config) {
        console.warn(`⚠️ Servicio no configurado: ${service}`);
        return next();
      }

      // Validar métrica
      const metricConfig = config.metrics[metricName];
      if (!metricConfig) {
        console.warn(`⚠️ Métrica no configurada: ${service}.${metricName}`);
        return next();
      }

      // Obtener usuario (compatible con JWT y Clerk)
      const userId = req.user?.id;
      const clerkUserId = req.user?.clerk_id || null;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        });
      }

      // Asegurar que existe suscripción
      await ensureSubscription(userId, clerkUserId, service);

      // Determinar período
      const period = getPeriodKey(metricConfig.reset);

      // Resetear métricas si es necesario
      await resetMetricsIfNeeded(userId, service);

      // Obtener tier del usuario
      const userTier = await getUserTier(userId, service);
      const tierLimits = config.tiers[userTier];

      // Obtener uso actual
      const currentUsage = await getUserUsage(userId, service, period);
      const currentValue = currentUsage[metricName]?.value || 0;

      // Verificar límite
      const limit = tierLimits[metricName];
      const isUnlimited = limit === -1;

      if (!isUnlimited && currentValue >= limit) {
        return res.status(429).json({
          success: false,
          message: `Has alcanzado el límite de ${metricName} para tu plan ${userTier}`,
          error_code: 'USAGE_LIMIT_REACHED',
          data: {
            service,
            metric: metricName,
            current: currentValue,
            limit,
            tier: userTier,
            upgrade_available: userTier !== 'enterprise'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Incrementar métrica después de respuesta exitosa
      res.on('finish', async () => {
        if (res.statusCode < 400) {
          const incrementBy = options.incrementBy || 1;
          try {
            await incrementMetric(userId, service, metricName, period, incrementBy);
          } catch (error) {
            console.error('Error incrementando métrica post-response:', error);
          }
        }
      });

      // Agregar info de uso a la respuesta
      res.locals.usageInfo = {
        service,
        metric: metricName,
        current: currentValue,
        limit: isUnlimited ? 'unlimited' : limit,
        remaining: isUnlimited ? 'unlimited' : limit - currentValue,
        tier: userTier,
        percentage: isUnlimited ? 0 : Math.round((currentValue / limit) * 100)
      };

      // Headers informativos
      res.set({
        'X-Service': service,
        'X-Usage-Current': currentValue,
        'X-Usage-Limit': isUnlimited ? 'unlimited' : limit,
        'X-Usage-Remaining': isUnlimited ? 'unlimited' : (limit - currentValue),
        'X-User-Tier': userTier
      });

      console.log(`📊 [${service}] ${metricName}: ${currentValue}/${isUnlimited ? '∞' : limit} (${userTier})`);

      next();

    } catch (error) {
      console.error('Error en middleware de métricas:', error);
      // No bloquear la request en caso de error
      next();
    }
  };
};

/**
 * Obtener clave de período según tipo de reset
 */
function getPeriodKey(resetType) {
  const now = new Date();
  
  switch (resetType) {
    case 'daily':
      return now.toISOString().split('T')[0]; // YYYY-MM-DD
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    case 'never':
      return 'permanent';
    default:
      return 'unknown';
  }
}

// ============================================================================
// 📊 ENDPOINT DE ESTADÍSTICAS
// ============================================================================

/**
 * Obtener estadísticas de uso del usuario
 * GET /api/usage/stats?service=cash-flow
 */
export const getUserUsageStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    const { service } = req.query;
    
    if (!service || !SERVICE_CONFIGS[service]) {
      return res.status(400).json({
        success: false,
        message: 'Servicio inválido o no especificado'
      });
    }

    const config = SERVICE_CONFIGS[service];
    const userTier = await getUserTier(userId, service);
    const tierLimits = config.tiers[userTier];

    // Obtener uso para todos los períodos relevantes
    const stats = {
      service,
      tier: userTier,
      features: tierLimits.features,
      restrictions: tierLimits.restrictions || {},
      metrics: {}
    };

    for (const [metricName, metricConfig] of Object.entries(config.metrics)) {
      const period = getPeriodKey(metricConfig.reset);
      const usage = await getUserUsage(userId, service, period);
      const current = usage[metricName]?.value || 0;
      const limit = tierLimits[metricName];
      const isUnlimited = limit === -1;

      stats.metrics[metricName] = {
        current,
        limit: isUnlimited ? 'unlimited' : limit,
        remaining: isUnlimited ? 'unlimited' : Math.max(0, limit - current),
        percentage: isUnlimited ? 0 : Math.round((current / limit) * 100),
        reset_type: metricConfig.reset,
        next_reset: getNextResetDate(metricConfig.reset)
      };
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de uso',
      error: error.message
    });
  }
};

/**
 * Obtener fecha del próximo reset
 */
function getNextResetDate(resetType) {
  const now = new Date();
  
  switch (resetType) {
    case 'daily':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.toISOString();
    
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth.toISOString();
    
    case 'never':
      return null;
    
    default:
      return null;
  }
}

// ============================================================================
// 🔧 UTILIDADES
// ============================================================================

export const SERVICE_CONFIGS_EXPORT = SERVICE_CONFIGS;

export default {
  trackUsage,
  getUserUsageStats,
  SERVICE_CONFIGS: SERVICE_CONFIGS_EXPORT
};