// src/routes/budgetSuggestionsRoutes.mjs - VERSIÓN LIMPIA Y CORREGIDA
import express from 'express';
import { body } from 'express-validator';
import { clerkAuth as authenticate } from '../middleware/clerkAuth.mjs';
import budgetController from '../controllers/budgetSuggestionsController.mjs';
import { 
  uploadPdfForAnalysis, 
  handlePdfUploadErrors, 
  validatePdfPresence 
} from '../middleware/pdfUploadMiddleware.mjs';

// 🔥 NUEVO: Importar middleware de control de costos
import { 
  costControlMiddleware, 
  getCostStatus, 
  registerActualCost
} from '../middleware/costControlMiddleware.mjs';

// 🔥 NUEVO: Importar funciones de validación
import { 
  validatePdfBeforeProcessing, 
  estimateApiCosts, 
  estimateCostFromFileSize
} from '../services/pdfAnalysisOptimizer.mjs';

const router = express.Router();

/**
 * @route   GET /api/budget-analysis/health
 * @desc    Verifica el estado del servicio de análisis presupuestario
 * @access  Público
 */
router.get('/api/budget-analysis/health', async (req, res) => {
  try {
    console.log('🏥 Health check del servicio de análisis presupuestario');
    
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    
    res.json({
      success: true,
      service: 'Budget Analysis AI',
      status: 'healthy',
      checks: {
        api_key_configured: hasApiKey,
        anthropic_service: 'available',
        database_connection: 'ok',
        cost_control: 'active'
      },
      capabilities: [
        'budget_analysis',
        'pdf_analysis',
        'risk_assessment', 
        'regional_factors',
        'market_insights',
        'cost_optimization'
      ],
      supported_regions: [
        'Santiago - Metropolitana',
        'Valdivia - Los Ríos',
        'Concepción - Biobío',
        'Antofagasta - Antofagasta',
        'Valparaíso - Valparaíso'
      ],
      optimization_features: [
        'intelligent_chunking',
        'cost_estimation',
        'pre_validation',
        'rate_limiting'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Budget Analysis AI',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 🔥 NUEVA RUTA: Monitoreo de costos y límites
 * @route   GET /api/budget-analysis/cost-status
 * @desc    Obtiene estado actual de costos y límites
 * @access  Privado
 */
router.get('/api/budget-analysis/cost-status', authenticate, getCostStatus);

/**
 * @route   POST /api/budget-analysis/validate-project
 * @desc    Valida datos de proyecto antes de análisis
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/validate-project',
  authenticate,
  [
    body('type').notEmpty().withMessage('Tipo es requerido'),
    body('location').notEmpty().withMessage('Ubicación es requerida'),
    body('area').optional().isFloat({ min: 1 }).withMessage('Área debe ser positiva')
  ],
  (req, res) => {
    try {
      const projectData = {
        type: req.body.type,
        location: req.body.location,
        area: parseFloat(req.body.area) || null,
        estimatedBudget: parseFloat(req.body.estimatedBudget) || null,
        description: req.body.description
      };

      // Calcular score de confianza
      let confidenceScore = 0;
      const suggestions = [];

      if (projectData.type) confidenceScore += 25;
      if (projectData.location) confidenceScore += 25;
      if (projectData.area && projectData.area > 0) {
        confidenceScore += 30;
      } else {
        suggestions.push('Especificar área del proyecto mejorará la precisión');
      }
      
      if (projectData.estimatedBudget && projectData.estimatedBudget > 0) {
        confidenceScore += 20;
      } else {
        suggestions.push('Incluir presupuesto estimado permite mejor análisis');
      }

      // Determinar nivel de preparación
      let readinessLevel = 'poor';
      let estimatedQuality = 'basic';

      if (confidenceScore >= 80) {
        readinessLevel = 'excellent';
        estimatedQuality = 'high';
      } else if (confidenceScore >= 60) {
        readinessLevel = 'good';
        estimatedQuality = 'medium';
      } else if (confidenceScore >= 40) {
        readinessLevel = 'fair';
        estimatedQuality = 'medium';
      }

      res.json({
        success: true,
        message: 'Validación de proyecto completada',
        data: {
          confidence_score: confidenceScore,
          is_analyzable: confidenceScore >= 40,
          readiness_level: readinessLevel,
          suggestions,
          estimated_analysis_quality: estimatedQuality
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en validación',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 🔥 RUTA PRINCIPAL: Análisis rápido sin asociar a proyecto específico
 * @route   POST /api/budget-analysis/quick
 * @desc    Genera análisis rápido sin asociar a proyecto específico
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/quick',
  authenticate,
  costControlMiddleware,
  [
    body('type').notEmpty().withMessage('Tipo de proyecto es requerido'),
    body('location').notEmpty().withMessage('Ubicación es requerida'),
    body('area').isFloat({ min: 1 }).withMessage('Área debe ser un número positivo'),
    body('estimatedBudget').optional().isFloat({ min: 0 }).withMessage('Presupuesto debe ser positivo'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descripción muy larga')
  ],
  async (req, res, next) => {
    try {
      await budgetController.generateQuickAnalysis(req, res, next);
      
      // Registrar costo estimado
      if (req.estimatedCost) {
        registerActualCost(req.estimatedCost, req.userDailyKey);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/projects/:projectId/budget-analysis
 * @desc    Genera análisis para proyecto específico existente
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/budget-analysis',
  authenticate,
  costControlMiddleware,
  [
    body('projectData.type').optional().notEmpty().withMessage('Tipo de proyecto es requerido'),
    body('projectData.location').optional().notEmpty().withMessage('Ubicación es requerida'),
    body('projectData.area').optional().isFloat({ min: 1 }).withMessage('Área debe ser un número positivo')
  ],
  async (req, res, next) => {
    try {
      await budgetController.generateAnalysis(req, res, next);
      
      // Registrar costo estimado
      if (req.estimatedCost) {
        registerActualCost(req.estimatedCost, req.userDailyKey);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 🔥 NUEVA RUTA: Validación previa de PDF sin análisis
 * @route   POST /api/budget-analysis/pdf/validate
 * @desc    Valida archivo PDF y estima costos sin analizarlo
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/pdf/validate',
  authenticate,
  costControlMiddleware,
  uploadPdfForAnalysis,
  handlePdfUploadErrors,
  validatePdfPresence,
  async (req, res) => {
    try {
      console.log('🔍 Validando PDF antes del análisis');

      const fileValidation = validatePdfBeforeProcessing(
        req.file.buffer, 
        req.file.originalname
      );

      if (!fileValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: fileValidation.errors[0],
          error_code: 'INVALID_FILE',
          file_validation: fileValidation,
          timestamp: new Date().toISOString()
        });
      }

      // Estimar costos sin procesar
      const costEstimate = estimateCostFromFileSize(req.file.size);

      res.json({
        success: true,
        message: 'Validación de PDF completada',
        data: {
          file_validation: fileValidation,
          cost_estimate: costEstimate,
          recommendation: costEstimate.estimated_cost_usd > 1.5
            ? 'ARCHIVO_GRANDE_CONSIDERAR_REDUCIR'
            : costEstimate.estimated_cost_usd > 0.5
            ? 'ARCHIVO_MEDIO_PROCEDER_CON_CUIDADO'
            : 'ARCHIVO_OPTIMO_PARA_ANALISIS',
          warnings: fileValidation.warnings,
          processing_tips: [
            costEstimate.estimated_cost_usd > 1.0 
              ? 'Considere dividir el archivo en secciones más pequeñas'
              : null,
            'Use archivos con texto seleccionable para mejores resultados',
            'Formato de tabla mejora la extracción de datos'
          ].filter(Boolean)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error en validación PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Error en validación de archivo',
        error_code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 🔥 RUTA PRINCIPAL OPTIMIZADA: Análisis de PDF con control de costos
 * @route   POST /api/budget-analysis/pdf
 * @desc    Analiza un archivo PDF de presupuesto con optimizaciones anti-desperdicio
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/pdf',
  authenticate,
  costControlMiddleware,
  uploadPdfForAnalysis,
  handlePdfUploadErrors,
  validatePdfPresence,
  [
    body('analysisDepth').optional().isIn(['basic', 'standard', 'detailed']).withMessage('Profundidad de análisis inválida'),
    body('projectType').optional().isIn(['residential', 'commercial', 'industrial', 'infrastructure', 'renovation']).withMessage('Tipo de proyecto inválido'),
    body('projectLocation').optional().isString().withMessage('Ubicación debe ser texto'),
    body('includeProviders').optional().isBoolean().withMessage('includeProviders debe ser booleano'),
    body('maxCostEstimate').optional().isFloat({ min: 0 }).withMessage('Costo máximo debe ser positivo')
  ],
  async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      console.log('📄 Iniciando análisis PDF optimizado');

      // Validación previa del archivo
      const fileValidation = validatePdfBeforeProcessing(
        req.file.buffer, 
        req.file.originalname
      );

      if (!fileValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: fileValidation.errors[0],
          error_code: 'INVALID_FILE',
          timestamp: new Date().toISOString()
        });
      }

      // Estimación de costos
      const estimatedTextLength = req.file.size * 1.2;
      const costEstimate = estimateApiCosts(estimatedTextLength, req.body);
      
      console.log(`💰 Costo estimado: $${costEstimate.estimated_cost_usd.toFixed(3)} USD`);

      // Límite de seguridad
      const MAX_COST_USD = process.env.NODE_ENV === 'production' ? 3.0 : 1.5;
      
      if (costEstimate.estimated_cost_usd > MAX_COST_USD) {
        return res.status(400).json({
          success: false,
          message: `Análisis demasiado costoso (${costEstimate.estimated_cost_usd.toFixed(2)} USD estimado). Máximo permitido: $${MAX_COST_USD}. Use un archivo más pequeño o divídalo en secciones.`,
          error_code: 'COST_LIMIT_EXCEEDED',
          cost_estimate: costEstimate,
          suggestions: [
            'Dividir el PDF en archivos más pequeños',
            'Usar formato Excel en lugar de PDF escaneado',
            'Asegurar que el texto sea seleccionable'
          ],
          timestamp: new Date().toISOString()
        });
      }

      // Agregar información al request
      req.costEstimate = costEstimate;
      req.maxAllowedCost = MAX_COST_USD;

      // Ejecutar análisis
      await budgetController.analyzePdfBudget(req, res, next);
      
      // Registrar costo real
      const processingTime = Date.now() - startTime;
      const actualCost = req.costEstimate?.estimated_cost_usd || costEstimate.estimated_cost_usd;
      
      registerActualCost(actualCost, req.userDailyKey);
      
      console.log('✅ Análisis PDF completado:', {
        tiempo: `${processingTime}ms`,
        costo: `$${actualCost.toFixed(3)} USD`,
        archivo: req.file.originalname
      });

    } catch (error) {
      console.error('❌ Error en análisis PDF optimizado:', error);
      
      let errorMessage = 'Error interno en análisis PDF';
      let errorCode = 'ANALYSIS_ERROR';
      let statusCode = 500;

      if (error.message.includes('COST_LIMIT')) {
        errorMessage = error.message;
        errorCode = 'COST_LIMIT_EXCEEDED';
        statusCode = 400;
      } else if (error.message.includes('429') || error.message.includes('límite')) {
        errorMessage = 'Límite de API alcanzado. Intente en 5 minutos.';
        errorCode = 'RATE_LIMIT';
        statusCode = 429;
      } else if (error.message.includes('415') || error.message.includes('formato')) {
        errorMessage = 'Solo se permiten archivos PDF válidos.';
        errorCode = 'INVALID_FORMAT';
        statusCode = 415;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error_code: errorCode,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  }
);

/**
 * @route   GET /api/budget-analysis/pdf/:analysisId
 * @desc    Obtiene resultado de análisis PDF por ID
 * @access  Privado
 */
router.get(
  '/api/budget-analysis/pdf/:analysisId',
  authenticate,
  budgetController.getPdfAnalysisResult
);

/**
 * @route   POST /api/budget-analysis/pdf/compare
 * @desc    Compara múltiples análisis de PDF
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/pdf/compare',
  authenticate,
  costControlMiddleware,
  [
    body('analysisIds').isArray({ min: 2, max: 5 }).withMessage('Se requieren entre 2 y 5 análisis para comparar'),
    body('analysisIds.*').isString().withMessage('IDs de análisis deben ser strings'),
    body('comparisonType').optional().isIn(['materials', 'labor', 'providers', 'total_cost']).withMessage('Tipo de comparación inválido')
  ],
  async (req, res, next) => {
    try {
      await budgetController.comparePdfAnalyses(req, res, next);
      
      // Registrar costo de comparación
      registerActualCost(0.05, req.userDailyKey);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/projects/:projectId/budget-analysis/history
 * @desc    Obtiene historial de análisis de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/budget-analysis/history',
  authenticate,
  budgetController.getAnalysisHistory
);

/**
 * @route   POST /api/projects/:projectId/budget-analysis/compare
 * @desc    Compara múltiples análisis de un proyecto
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/budget-analysis/compare',
  authenticate,
  costControlMiddleware,
  [
    body('analysisIds').isArray({ min: 2, max: 10 }).withMessage('Se requieren entre 2 y 10 análisis para comparar'),
    body('analysisIds.*').isString().withMessage('IDs de análisis deben ser strings'),
    body('comparisonType').optional().isIn(['materials', 'labor', 'providers', 'total_cost']).withMessage('Tipo de comparación inválido')
  ],
  async (req, res, next) => {
    try {
      await budgetController.compareProjectAnalyses(req, res, next);
      
      // Registrar costo de comparación
      registerActualCost(0.08, req.userDailyKey);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/budget-analysis/validate-config
 * @desc    Valida configuración de análisis antes de ejecutar
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/validate-config',
  authenticate,
  [
    body('analysisDepth').isIn(['basic', 'standard', 'detailed']).withMessage('Profundidad de análisis inválida'),
    body('includeMarketData').optional().isBoolean().withMessage('includeMarketData debe ser booleano'),
    body('includeHistoricalData').optional().isBoolean().withMessage('includeHistoricalData debe ser booleano')
  ],
  (req, res) => {
    try {
      const { analysisDepth, includeMarketData, includeHistoricalData } = req.body;
      
      // Estimar tiempo y costo del análisis
      let estimatedTime = 30;
      let estimatedCost = 0.10;
      
      switch (analysisDepth) {
        case 'detailed':
          estimatedTime *= 3;
          estimatedCost *= 2.5;
          break;
        case 'standard':
          estimatedTime *= 2;
          estimatedCost *= 1.5;
          break;
        case 'basic':
        default:
          break;
      }
      
      if (includeMarketData) {
        estimatedTime += 15;
        estimatedCost += 0.05;
      }
      
      if (includeHistoricalData) {
        estimatedTime += 20;
        estimatedCost += 0.08;
      }

      res.json({
        success: true,
        message: 'Configuración validada',
        data: {
          is_valid: true,
          estimated_processing_time: estimatedTime,
          estimated_cost_usd: estimatedCost,
          estimated_cost_clp: estimatedCost * 950,
          recommendations: [
            analysisDepth === 'basic' ? 'Para proyectos complejos, considere usar análisis "standard" o "detailed"' : null,
            !includeMarketData ? 'Incluir datos de mercado mejora la precisión de costos' : null,
            !includeHistoricalData ? 'Datos históricos ayudan con tendencias de precios' : null,
            estimatedCost > 1.0 ? 'Costo estimado alto - considere análisis básico' : null
          ].filter(Boolean)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error validando configuración',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/budget-analysis/usage/stats
 * @desc    Obtiene estadísticas de uso del servicio por usuario
 * @access  Privado
 */
router.get(
  '/api/budget-analysis/usage/stats',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user?.id || 'unknown';
      const environment = process.env.NODE_ENV || 'development';

      const mockStats = {
        user_id: userId,
        environment,
        current_month: {
          budget_analyses: 5,
          pdf_analyses: 2,
          comparisons: 1,
          total_cost_usd: 1.25,
          total_cost_clp: 1187
        },
        limits: {
          monthly_analyses: 50,
          pdf_analyses: 20,
          max_file_size_mb: 20,
          concurrent_analyses: 3,
          daily_cost_limit_usd: environment === 'production' ? 8.0 : 2.0,
          global_daily_limit_usd: environment === 'production' ? 20.0 : 5.0
        },
        usage_percentage: {
          budget_analyses: 10,
          pdf_analyses: 10,
          daily_cost: 25
        },
        optimization_stats: {
          average_cost_per_analysis: 0.42,
          tokens_saved_this_month: 15000,
          cost_saved_usd: 0.75,
          files_rejected_oversized: 2,
          optimizations_applied: 8
        }
      };

      res.json({
        success: true,
        message: 'Estadísticas de uso obtenidas',
        data: mockStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas de uso',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * 🔥 NUEVA RUTA: Endpoint de emergencia para resetear límites (solo desarrollo)
 */
router.post(
  '/api/budget-analysis/emergency/reset-limits',
  authenticate,
  async (req, res) => {
    try {
      const environment = process.env.NODE_ENV || 'development';
      
      if (environment === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Operación no permitida en producción',
          error_code: 'FORBIDDEN_IN_PRODUCTION',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Límites de desarrollo reseteados exitosamente',
        warning: 'Esta operación solo está disponible en desarrollo',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error en reset de límites:', error);
      res.status(500).json({
        success: false,
        message: 'Error reseteando límites',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Error handler específico para rutas de budget analysis
 */
router.use((error, req, res, next) => {
  console.error('❌ Error en rutas de budget analysis:', {
    error: error.message,
    route: req.originalUrl,
    method: req.method,
    user_id: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });
  
  if (res.headersSent) {
    return next(error);
  }
  
  if (error.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: error.errors,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('COST_LIMIT') || error.message.includes('límite')) {
    return res.status(429).json({
      success: false,
      message: error.message,
      error_code: 'COST_LIMIT_ERROR',
      retry_after: 3600,
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error_code: 'INTERNAL_SERVER_ERROR',
    request_id: `req_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
});

export default router;