// src/controllers/usageStatsController.mjs
import { pool } from '../config/database.mjs';

// LÍMITES CORRECTOS: Free tier = 3 diarios, 10 mensuales
const SERVICE_CONFIGS = {
  'budget-analyzer': {
    metrics: {
      daily_analyses: { reset: 'daily' },
      monthly_analyses: { reset: 'monthly' }
    },
    tiers: {
      free: { 
        daily_analyses: 3,        // ✅ CORRECTO
        monthly_analyses: 10,     // ✅ CORRECTO
        features: ['basic_analysis', 'pdf_upload']
      },
      pro: { 
        daily_analyses: 10, 
        monthly_analyses: 100,
        features: ['basic_analysis', 'pdf_upload', 'comparisons', 'advanced_insights']
      },
      enterprise: { 
        daily_analyses: -1,       // Ilimitado
        monthly_analyses: -1,     // Ilimitado
        features: ['all']
      }
    }
  },
  'cash-flow': {
    metrics: {
      transactions: { reset: 'monthly' },
      organizations: { reset: 'never' },
      export_reports: { reset: 'monthly' },
      advanced_projections: { reset: 'monthly' }
    },
    tiers: {
      free: { 
        transactions: 100, 
        organizations: 1, 
        export_reports: 5, 
        advanced_projections: 3,
        features: ['basic_cashflow', 'manual_entry', 'basic_reports']
      },
      starter: { 
        transactions: 500, 
        organizations: 3, 
        export_reports: 50, 
        advanced_projections: 20,
        features: ['basic_cashflow', 'manual_entry', 'basic_reports', 'excel_export']
      },
      professional: { 
        transactions: 2000, 
        organizations: 10, 
        export_reports: -1, 
        advanced_projections: 100,
        features: ['all_cashflow']
      },
      enterprise: { 
        transactions: -1, 
        organizations: -1, 
        export_reports: -1, 
        advanced_projections: -1,
        features: ['all']
      }
    }
  }
};

async function getUserTier(userId, service) {
  try {
    const [rows] = await pool.query(
      `SELECT tier FROM user_service_subscriptions 
       WHERE user_id = ? AND service = ? AND active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, service]
    );
    const tier = rows.length > 0 ? rows[0].tier : 'free';
    console.log(`📊 User ${userId} - ${service}: tier=${tier}`);
    return tier;
  } catch (error) {
    console.error('❌ Error obteniendo tier:', error);
    return 'free';
  }
}

async function getUserUsage(userId, service, period) {
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

    return usage;
  } catch (error) {
    console.error('❌ Error obteniendo uso:', error);
    return {};
  }
}

function getPeriodKey(resetType) {
  const now = new Date();
  
  switch (resetType) {
    case 'daily':
      return now.toISOString().split('T')[0];
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    case 'never':
      return 'permanent';
    default:
      return 'unknown';
  }
}

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

/**
 * Obtener estadísticas de uso del usuario
 * GET /api/usage/stats?service=budget-analyzer
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
        message: 'Servicio inválido o no especificado',
        valid_services: Object.keys(SERVICE_CONFIGS)
      });
    }

    console.log(`📊 ==> Stats request: user=${userId}, service=${service}`);

    const config = SERVICE_CONFIGS[service];
    const userTier = await getUserTier(userId, service);
    const tierLimits = config.tiers[userTier];

    const stats = {
      service,
      tier: userTier,
      features: tierLimits.features || [],
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

      console.log(`   └─ ${metricName}: ${current}/${isUnlimited ? '∞' : limit}`);
    }

    console.log(`✅ Stats enviadas (tier: ${userTier})`);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de uso',
      error: error.message
    });
  }
};

export default { getUserUsageStats };