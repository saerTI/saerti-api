// src/middleware/costControlMiddleware.mjs
// 🛡️ MIDDLEWARE DE CONTROL DE COSTOS - IMPLEMENTACIÓN COMPLETA

const DAILY_COST_LIMITS = {
  development: 5.0,   // $5 USD por día en desarrollo
  production: 20.0    // $20 USD por día en producción
};

const HOURLY_ANALYSIS_LIMITS = {
  development: 10,     // 10 análisis por hora en desarrollo
  production: 30       // 30 análisis por hora en producción
};

// Almacenamiento en memoria (en producción considerar Redis)
const costTracker = {
  dailyCosts: new Map(),
  hourlyAnalyses: new Map(),
  userCosts: new Map() // Por usuario
};

/**
 * 🔥 Middleware principal de control de costos
 */
export const costControlMiddleware = async (req, res, next) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = `${today}-${now.getHours()}`;
    const environment = process.env.NODE_ENV || 'development';
    const userId = req.user?.id || 'anonymous';

    // 1. Verificar límite diario global
    const dailyCost = costTracker.dailyCosts.get(today) || 0;
    const dailyLimit = DAILY_COST_LIMITS[environment];

    if (dailyCost >= dailyLimit) {
      return res.status(429).json({
        success: false,
        message: `Límite diario de costos alcanzado ($${dailyLimit} USD). Sistema en modo conservación.`,
        error_code: 'DAILY_COST_LIMIT',
        retry_after: getSecondsUntilMidnight(),
        current_cost: dailyCost,
        limit: dailyLimit,
        next_reset: getNextMidnight(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. Verificar límite horario de análisis
    const hourlyCount = costTracker.hourlyAnalyses.get(currentHour) || 0;
    const hourlyLimit = HOURLY_ANALYSIS_LIMITS[environment];

    if (hourlyCount >= hourlyLimit) {
      return res.status(429).json({
        success: false,
        message: `Límite horario de análisis alcanzado (${hourlyLimit} por hora). Intente en la próxima hora.`,
        error_code: 'HOURLY_ANALYSIS_LIMIT',
        retry_after: 3600 - (now.getMinutes() * 60 + now.getSeconds()),
        current_count: hourlyCount,
        limit: hourlyLimit,
        next_reset: getNextHour(),
        timestamp: new Date().toISOString()
      });
    }

    // 3. Verificar límite por usuario (opcional)
    const userDailyKey = `${userId}-${today}`;
    const userDailyCost = costTracker.userCosts.get(userDailyKey) || 0;
    const userDailyLimit = environment === 'development' ? 2.0 : 8.0;

    if (userDailyCost >= userDailyLimit) {
      return res.status(429).json({
        success: false,
        message: `Límite diario personal alcanzado ($${userDailyLimit} USD). Intente mañana.`,
        error_code: 'USER_DAILY_LIMIT',
        retry_after: getSecondsUntilMidnight(),
        current_cost: userDailyCost,
        limit: userDailyLimit,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Estimar costo del análisis actual
    if (req.file) {
      const estimatedCost = estimateAnalysisCost(req.file.size);
      
      // Verificar si excedería límites
      if (dailyCost + estimatedCost > dailyLimit) {
        return res.status(429).json({
          success: false,
          message: `Análisis excedería límite diario global ($${(dailyCost + estimatedCost).toFixed(2)} > $${dailyLimit})`,
          error_code: 'WOULD_EXCEED_DAILY_LIMIT',
          current_cost: dailyCost,
          estimated_cost: estimatedCost,
          limit: dailyLimit,
          suggestion: 'Use un archivo más pequeño o espere hasta mañana',
          timestamp: new Date().toISOString()
        });
      }

      if (userDailyCost + estimatedCost > userDailyLimit) {
        return res.status(429).json({
          success: false,
          message: `Análisis excedería su límite diario personal ($${(userDailyCost + estimatedCost).toFixed(2)} > $${userDailyLimit})`,
          error_code: 'WOULD_EXCEED_USER_LIMIT',
          current_cost: userDailyCost,
          estimated_cost: estimatedCost,
          limit: userDailyLimit,
          timestamp: new Date().toISOString()
        });
      }

      // Guardar estimación en request para usar después
      req.estimatedCost = estimatedCost;
      req.userDailyKey = userDailyKey;
    }

    // 5. Incrementar contador horario
    costTracker.hourlyAnalyses.set(currentHour, hourlyCount + 1);

    // 6. Agregar headers informativos
    res.set({
      'X-Daily-Cost-Used': dailyCost.toFixed(2),
      'X-Daily-Cost-Limit': dailyLimit,
      'X-User-Daily-Cost': userDailyCost.toFixed(2),
      'X-User-Daily-Limit': userDailyLimit,
      'X-Hourly-Count': hourlyCount + 1,
      'X-Hourly-Limit': hourlyLimit,
      'X-Environment': environment
    });

    console.log(`🛡️ Control de costos: Diario $${dailyCost.toFixed(2)}/$${dailyLimit} | Usuario $${userDailyCost.toFixed(2)}/$${userDailyLimit} | Hora ${hourlyCount + 1}/${hourlyLimit}`);

    next();

  } catch (error) {
    console.error('Error en cost control middleware:', error);
    next(); // Continuar en caso de error en el middleware
  }
};

/**
 * 🔥 Middleware para registrar costos reales después del análisis
 */
export const registerActualCost = (actualCostUsd, userDailyKey = null) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Registrar costo global
  const currentCost = costTracker.dailyCosts.get(today) || 0;
  costTracker.dailyCosts.set(today, currentCost + actualCostUsd);
  
  // Registrar costo por usuario si se proporciona la clave
  if (userDailyKey) {
    const userCurrentCost = costTracker.userCosts.get(userDailyKey) || 0;
    costTracker.userCosts.set(userDailyKey, userCurrentCost + actualCostUsd);
  }
  
  console.log(`💰 Costo registrado: $${actualCostUsd.toFixed(3)} USD (Total diario: $${(currentCost + actualCostUsd).toFixed(2)})`);
};

/**
 * Estima el costo basado en el tamaño del archivo
 */
const estimateAnalysisCost = (fileSizeBytes) => {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  
  // Estimación basada en experiencia real
  if (fileSizeMB < 1) return 0.10;
  if (fileSizeMB < 5) return 0.25;
  if (fileSizeMB < 10) return 0.50;
  if (fileSizeMB < 20) return 1.00;
  return 2.00;
};

/**
 * Calcula segundos hasta medianoche
 */
const getSecondsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
};

/**
 * Obtiene la próxima medianoche
 */
const getNextMidnight = () => {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.toISOString();
};

/**
 * Obtiene la próxima hora
 */
const getNextHour = () => {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return nextHour.toISOString();
};

/**
 * 🔥 Función para limpiar datos antiguos (ejecutar diariamente)
 */
export const cleanupOldData = () => {
  const today = new Date().toISOString().split('T')[0];

  // Limpiar costos diarios de hace más de 7 días
  for (const [date] of costTracker.dailyCosts) {
    const daysDiff = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) {
      costTracker.dailyCosts.delete(date);
    }
  }

  // Limpiar contadores horarios de hace más de 24 horas
  for (const [hourKey] of costTracker.hourlyAnalyses) {
    const [date, hour] = hourKey.split('-');
    const hoursAgo = Math.floor((new Date() - new Date(`${date}T${hour}:00:00`)) / (1000 * 60 * 60));
    if (hoursAgo > 24) {
      costTracker.hourlyAnalyses.delete(hourKey);
    }
  }

  // Limpiar costos de usuario de hace más de 30 días
  for (const [userKey] of costTracker.userCosts) {
    const [userId, date] = userKey.split('-');
    const daysDiff = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      costTracker.userCosts.delete(userKey);
    }
  }

  console.log('🧹 Limpieza de datos de costos completada');
};

/**
 * 🔥 Endpoint para monitoreo de costos
 */
export const getCostStatus = (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const currentHour = `${today}-${new Date().getHours()}`;
  const environment = process.env.NODE_ENV || 'development';
  const userId = req.user?.id || 'anonymous';
  const userDailyKey = `${userId}-${today}`;

  const status = {
    environment,
    timestamp: new Date().toISOString(),
    global_usage: {
      daily: {
        date: today,
        cost_used: costTracker.dailyCosts.get(today) || 0,
        cost_limit: DAILY_COST_LIMITS[environment],
        percentage_used: ((costTracker.dailyCosts.get(today) || 0) / DAILY_COST_LIMITS[environment] * 100).toFixed(1),
        remaining: Math.max(0, DAILY_COST_LIMITS[environment] - (costTracker.dailyCosts.get(today) || 0))
      },
      hourly: {
        hour: currentHour,
        analyses_count: costTracker.hourlyAnalyses.get(currentHour) || 0,
        analyses_limit: HOURLY_ANALYSIS_LIMITS[environment],
        percentage_used: ((costTracker.hourlyAnalyses.get(currentHour) || 0) / HOURLY_ANALYSIS_LIMITS[environment] * 100).toFixed(1),
        remaining: Math.max(0, HOURLY_ANALYSIS_LIMITS[environment] - (costTracker.hourlyAnalyses.get(currentHour) || 0))
      }
    },
    user_usage: {
      user_id: userId,
      daily_cost: costTracker.userCosts.get(userDailyKey) || 0,
      daily_limit: environment === 'development' ? 2.0 : 8.0,
      percentage_used: ((costTracker.userCosts.get(userDailyKey) || 0) / (environment === 'development' ? 2.0 : 8.0) * 100).toFixed(1),
      remaining: Math.max(0, (environment === 'development' ? 2.0 : 8.0) - (costTracker.userCosts.get(userDailyKey) || 0))
    },
    system_health: {
      is_healthy: true,
      tracked_days: costTracker.dailyCosts.size,
      tracked_hours: costTracker.hourlyAnalyses.size,
      tracked_users: costTracker.userCosts.size,
      last_cleanup: new Date().toISOString()
    },
    limits_info: {
      daily_cost_limits: DAILY_COST_LIMITS,
      hourly_analysis_limits: HOURLY_ANALYSIS_LIMITS,
      user_daily_limits: {
        development: 2.0,
        production: 8.0
      }
    }
  };

  res.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString()
  });
};

/**
 * 🔥 Función auxiliar para obtener estadísticas de uso
 */
export const getUsageStats = (userId = null) => {
  const today = new Date().toISOString().split('T')[0];
  const currentHour = `${today}-${new Date().getHours()}`;
  const environment = process.env.NODE_ENV || 'development';

  const stats = {
    global: {
      daily_cost: costTracker.dailyCosts.get(today) || 0,
      daily_limit: DAILY_COST_LIMITS[environment],
      hourly_count: costTracker.hourlyAnalyses.get(currentHour) || 0,
      hourly_limit: HOURLY_ANALYSIS_LIMITS[environment]
    }
  };

  if (userId) {
    const userDailyKey = `${userId}-${today}`;
    stats.user = {
      daily_cost: costTracker.userCosts.get(userDailyKey) || 0,
      daily_limit: environment === 'development' ? 2.0 : 8.0
    };
  }

  return stats;
};

/**
 * 🔥 Middleware específico para análisis PDF (con logging mejorado)
 */
export const pdfAnalysisCostControl = async (req, res, next) => {
  console.log('📄 Control de costos específico para análisis PDF');
  
  // Ejecutar control de costos general
  await costControlMiddleware(req, res, (error) => {
    if (error) {
      console.error('Error en control de costos PDF:', error);
      return next(error);
    }

    // Logging específico para PDF
    if (req.file) {
      console.log(`📄 Archivo PDF: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
      console.log(`💰 Costo estimado: ${req.estimatedCost?.toFixed(3) || '0.000'} USD`);
    }

    next();
  });
};

// Configurar limpieza automática cada 6 horas
const cleanupInterval = setInterval(cleanupOldData, 6 * 60 * 60 * 1000);

// Exportar función para detener el interval (útil para tests)
export const stopCleanupInterval = () => {
  clearInterval(cleanupInterval);
};

export default costControlMiddleware;