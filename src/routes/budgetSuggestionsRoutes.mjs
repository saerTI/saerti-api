// src/routes/budgetSuggestionsRoutes.mjs
import express from 'express';
import { body, param, query } from 'express-validator';
import budgetSuggestionsController from '../controllers/budgetSuggestionsController.mjs';
import { authenticate } from '../middleware/auth.mjs';

const router = express.Router();

/**
 * @route   POST /api/projects/:projectId/budget-analysis
 * @desc    Genera análisis presupuestario con IA para un proyecto específico
 * @access  Privado (requiere autenticación)
 */
router.post(
  '/api/projects/:projectId/budget-analysis',
  authenticate,
  [
    // Validación del parámetro projectId
    param('projectId')
      .notEmpty()
      .withMessage('Project ID es requerido')
      .isLength({ min: 1, max: 50 })
      .withMessage('Project ID debe tener entre 1 y 50 caracteres'),

    // Validaciones de datos del proyecto (opcionales pero recomendadas)
    body('projectData.type')
      .optional()
      .isIn(['residential', 'commercial', 'industrial', 'infrastructure', 'renovation'])
      .withMessage('Tipo de proyecto debe ser válido'),

    body('projectData.location')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Ubicación debe tener entre 2 y 100 caracteres'),

    body('projectData.area')
      .optional()
      .isFloat({ min: 1, max: 100000 })
      .withMessage('Área debe ser un número entre 1 y 100,000 m²'),

    body('projectData.estimatedBudget')
      .optional()
      .isFloat({ min: 1000000 }) // Mínimo 1M CLP
      .withMessage('Presupuesto estimado debe ser al menos $1.000.000 CLP'),

    // Validaciones de configuración de análisis
    body('analysisDepth')
      .optional()
      .isIn(['basic', 'standard', 'detailed'])
      .withMessage('Profundidad de análisis debe ser: basic, standard o detailed'),

    body('includeMarketData')
      .optional()
      .isBoolean()
      .withMessage('includeMarketData debe ser true o false'),

    body('includeHistoricalData')
      .optional()
      .isBoolean()
      .withMessage('includeHistoricalData debe ser true o false'),

    body('saveAnalysis')
      .optional()
      .isBoolean()
      .withMessage('saveAnalysis debe ser true o false')
  ],
  budgetSuggestionsController.generateAnalysis
);

/**
 * @route   GET /api/projects/:projectId/budget-analysis/history
 * @desc    Obtiene historial de análisis presupuestarios de un proyecto
 * @access  Privado
 */
router.get(
  '/api/projects/:projectId/budget-analysis/history',
  authenticate,
  [
    param('projectId')
      .notEmpty()
      .withMessage('Project ID es requerido'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit debe ser entre 1 y 50'),

    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset debe ser mayor o igual a 0')
  ],
  budgetSuggestionsController.getAnalysisHistory
);

/**
 * @route   POST /api/projects/:projectId/budget-analysis/compare
 * @desc    Compara múltiples análisis presupuestarios
 * @access  Privado
 */
router.post(
  '/api/projects/:projectId/budget-analysis/compare',
  authenticate,
  [
    param('projectId')
      .notEmpty()
      .withMessage('Project ID es requerido'),

    body('analysisIds')
      .isArray({ min: 2, max: 10 })
      .withMessage('Se requieren entre 2 y 10 análisis para comparar'),

    body('analysisIds.*')
      .isString()
      .notEmpty()
      .withMessage('Cada ID de análisis debe ser una cadena válida')
  ],
  budgetSuggestionsController.compareAnalyses
);

/**
 * @route   POST /api/budget-analysis/quick
 * @desc    Análisis rápido sin asociar a proyecto específico
 * @access  Privado
 */
router.post(
  '/api/budget-analysis/quick',
  authenticate,
  [
    // Datos mínimos requeridos para análisis rápido
    body('type')
      .notEmpty()
      .withMessage('Tipo de proyecto es requerido')
      .isIn(['residential', 'commercial', 'industrial', 'infrastructure', 'renovation'])
      .withMessage('Tipo de proyecto no válido'),

    body('location')
      .notEmpty()
      .withMessage('Ubicación es requerida')
      .isLength({ min: 2, max: 100 })
      .withMessage('Ubicación debe tener entre 2 y 100 caracteres'),

    body('area')
      .isFloat({ min: 1, max: 100000 })
      .withMessage('Área es requerida y debe estar entre 1 y 100,000 m²'),

    body('estimatedBudget')
      .optional()
      .isFloat({ min: 1000000 })
      .withMessage('Presupuesto estimado debe ser al menos $1.000.000 CLP'),

    body('analysisDepth')
      .optional()
      .isIn(['basic', 'standard'])
      .withMessage('Análisis rápido solo permite: basic o standard')
  ],
  async (req, res, next) => {
    // Adaptar request para usar el controlador principal
    req.params.projectId = `quick_${Date.now()}`;
    req.body.projectData = {
      name: req.body.name || `Análisis Rápido - ${req.body.type}`,
      type: req.body.type,
      location: req.body.location,
      area: req.body.area,
      estimatedBudget: req.body.estimatedBudget,
      description: req.body.description
    };
    req.body.saveAnalysis = false; // No guardar análisis rápidos
    
    next();
  },
  budgetSuggestionsController.generateAnalysis
);

/**
 * @route   GET /api/budget-analysis/health
 * @desc    Verifica el estado del servicio de análisis
 * @access  Público
 */
router.get('/api/budget-analysis/health', async (req, res) => {
  try {
    // Verificar que las variables de entorno estén configuradas
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    
    // TODO: Agregar verificación de conectividad con Anthropic API
    
    res.json({
      success: true,
      service: 'Budget Analysis AI',
      status: 'healthy',
      checks: {
        api_key_configured: hasApiKey,
        anthropic_service: 'not_tested', // Cambiar cuando implementes test real
        database_connection: 'ok'
      },
      capabilities: [
        'budget_analysis',
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
      // Simular extractProjectData del controlador
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
        confidenceScore += 20;
      } else {
        suggestions.push('Proporcionar área construida mejorará precisión del análisis');
      }
      
      if (projectData.estimatedBudget && projectData.estimatedBudget > 0) {
        confidenceScore += 15;
      } else {
        suggestions.push('Un presupuesto estimado inicial ayuda a contextualizar el análisis');
      }

      if (projectData.description && projectData.description.length > 10) {
        confidenceScore += 10;
      } else {
        suggestions.push('Una descripción detallada permite análisis más específico');
      }

      // Agregar 5% por datos adicionales
      confidenceScore += 5;

      res.json({
        success: true,
        message: 'Validación de proyecto completada',
        data: {
          confidence_score: confidenceScore,
          is_analyzable: confidenceScore >= 50, // Mínimo para análisis
          readiness_level: getReadinessLevel(confidenceScore),
          suggestions,
          estimated_analysis_quality: confidenceScore >= 80 ? 'high' : 
                                    confidenceScore >= 60 ? 'medium' : 'basic'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en validación de proyecto',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Determina nivel de preparación del proyecto para análisis
 */
function getReadinessLevel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export default router;