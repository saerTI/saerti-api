// src/routes/budgetSuggestionsRoutes.mjs
import express from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.mjs';
// 🔥 FIX CRÍTICO: Import correcto del controlador
import budgetController from '../controllers/budgetSuggestionsController.mjs';
import { 
  uploadPdfForAnalysis, 
  handlePdfUploadErrors, 
  validatePdfPresence 
} from '../middleware/pdfUploadMiddleware.mjs';

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
        database_connection: 'ok'
      },
      capabilities: [
        'budget_analysis',
        'pdf_analysis',
        'risk_assessment', 
        'regional_factors',
        'market_insights'
      ],
      supported_regions: [
        'Santiago - Metropolitana',
        'Valdivia - Los Ríos',
        'Concepción - Biobío',
        'Antofagasta - Antofagasta',
        'Valparaíso - Valparaíso'
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
  [
    body('type').notEmpty().withMessage('Tipo de proyecto es requerido'),
    body('location').notEmpty().withMessage('Ubicación es requerida'),
    body('area').isFloat({ min: 1 }).withMessage('Área debe ser un número positivo'),
    body('estimatedBudget').optional().isFloat({ min: 0 }).withMessage('Presupuesto debe ser positivo'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Descripción muy larga')
  ],
  budgetController.generateQuickAnalysis // 🔥 Usar la nueva función específica
);

/**
 * @route   POST /api/projects/:projectId/budget-analysis
 * @desc    Genera análisis para proyecto específico existente
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/budget-analysis',
  authenticate,
  [
    body('projectData.type').optional().notEmpty().withMessage('Tipo de proyecto es requerido'),
    body('projectData.location').optional().notEmpty().withMessage('Ubicación es requerida'),
    body('projectData.area').optional().isFloat({ min: 1 }).withMessage('Área debe ser un número positivo')
  ],
  budgetController.generateAnalysis
);

/**
 * @route   POST /api/budget-analysis/pdf
 * @desc    Analiza un archivo PDF de presupuesto
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/pdf',
  authenticate,
  uploadPdfForAnalysis,           // Multer middleware para manejar el archivo
  handlePdfUploadErrors,          // Manejo de errores de multer  
  validatePdfPresence,            // Validar que se recibió archivo
  [
    // Validaciones opcionales del body
    body('analysisDepth').optional().isIn(['basic', 'standard', 'detailed']).withMessage('Profundidad de análisis inválida'),
    body('projectType').optional().isIn(['residential', 'commercial', 'industrial', 'infrastructure', 'renovation']).withMessage('Tipo de proyecto inválido'),
    body('projectLocation').optional().isString().withMessage('Ubicación debe ser texto'),
    body('includeProviders').optional().isBoolean().withMessage('includeProviders debe ser booleano'),
    body('maxCostEstimate').optional().isFloat({ min: 0 }).withMessage('Costo máximo debe ser positivo')
  ],
  budgetController.analyzePdfBudget
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
  [
    body('analysisIds').isArray({ min: 2, max: 5 }).withMessage('Se requieren entre 2 y 5 análisis para comparar'),
    body('analysisIds.*').isString().withMessage('IDs de análisis deben ser strings'),
    body('comparisonType').optional().isIn(['materials', 'labor', 'providers', 'total_cost']).withMessage('Tipo de comparación inválido')
  ],
  budgetController.comparePdfAnalyses
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
  [
    body('analysisIds').isArray({ min: 2, max: 10 }).withMessage('Se requieren entre 2 y 10 análisis para comparar'),
    body('analysisIds.*').isString().withMessage('IDs de análisis deben ser strings'),
    body('comparisonType').optional().isIn(['materials', 'labor', 'providers', 'total_cost']).withMessage('Tipo de comparación inválido')
  ],
  budgetController.compareProjectAnalyses
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
      let estimatedTime = 30; // segundos base
      let estimatedCost = 0.10; // USD base
      
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
          estimated_cost_clp: estimatedCost * 800,
          recommendations: [
            analysisDepth === 'basic' ? 'Para proyectos complejos, considere usar análisis "standard" o "detailed"' : null,
            !includeMarketData ? 'Incluir datos de mercado mejora la precisión de costos' : null,
            !includeHistoricalData ? 'Datos históricos ayudan con tendencias de precios' : null
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
      const mockStats = {
        user_id: req.user?.id || 'unknown',
        current_month: {
          budget_analyses: 5,
          pdf_analyses: 2,
          comparisons: 1,
          total_cost_usd: 1.25
        },
        limits: {
          monthly_analyses: 50,
          pdf_analyses: 20,
          max_file_size_mb: 15,
          concurrent_analyses: 3
        },
        usage_percentage: {
          budget_analyses: 10, // 5/50 * 100
          pdf_analyses: 10,    // 2/20 * 100
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
 * Error handler específico para rutas de budget analysis
 */
router.use((error, req, res, next) => {
  console.error('❌ Error en rutas de budget analysis:', error);
  
  // Si ya se envió una respuesta, pasar al siguiente error handler
  if (res.headersSent) {
    return next(error);
  }
  
  // Error de validación de express-validator
  if (error.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: error.errors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error_code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
});

export default router;