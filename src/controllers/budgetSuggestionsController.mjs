// src/controllers/budgetSuggestionsController.mjs
import { generateBudgetSuggestions } from '../services/claudeService.mjs';
import { validationResult } from 'express-validator';

/**
 * Controlador para generar sugerencias presupuestarias con IA
 */
export default {
  /**
   * Genera análisis presupuestario para un proyecto
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  async generateAnalysis(req, res, next) {
    try {
      console.log('🎯 Iniciando análisis presupuestario para proyecto:', req.params.projectId);
      
      // Validar errores de input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      // Extraer datos del proyecto del request
      const projectData = extractProjectData(req);
      
      // Validar datos mínimos requeridos
      const validation = validateProjectData(projectData);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Datos insuficientes para análisis',
          missing_fields: validation.missingFields,
          recommendations: validation.recommendations,
          timestamp: new Date().toISOString()
        });
      }

      // Configurar opciones de análisis
      const analysisOptions = {
        includeMarketData: req.body.includeMarketData !== false, // Default true
        includeHistoricalData: req.body.includeHistoricalData || false,
        analysisDepth: req.body.analysisDepth || 'standard' // basic, standard, detailed
      };

      console.log('📊 Configuración de análisis:', analysisOptions);

      // Generar análisis con Claude
      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);
      
      // Guardar análisis en base de datos (opcional)
      if (req.body.saveAnalysis !== false) {
        try {
          await saveAnalysisToDatabase(req.params.projectId, analysis, req.user?.id);
          console.log('💾 Análisis guardado en base de datos');
        } catch (saveError) {
          console.warn('⚠️ Error guardando análisis (continuando):', saveError.message);
        }
      }

      // Incrementar contador de uso del usuario
      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'budget_analysis');
      }

      // Respuesta exitosa
      res.json({
        success: true,
        message: 'Análisis presupuestario generado exitosamente',
        data: {
          analysis,
          project_info: {
            id: req.params.projectId,
            name: projectData.name,
            location: projectData.location,
            estimated_budget: projectData.estimatedBudget
          },
          analysis_config: analysisOptions
        },
        timestamp: new Date().toISOString()
      });

      console.log('✅ Análisis completado y enviado al cliente');

    } catch (error) {
      console.error('❌ Error en generateAnalysis:', error);
      
      // Manejo específico de errores
      if (error.message.includes('API key')) {
        return res.status(503).json({
          success: false,
          message: 'Servicio de análisis temporalmente no disponible',
          error_code: 'AI_SERVICE_UNAVAILABLE',
          timestamp: new Date().toISOString()
        });
      }

      if (error.message.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          message: 'Límite de análisis alcanzado. Intente nuevamente en unos minutos',
          error_code: 'RATE_LIMIT_EXCEEDED',
          retry_after: 300, // 5 minutes
          timestamp: new Date().toISOString()
        });
      }

      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno en análisis presupuestario',
        error_code: 'ANALYSIS_ERROR',
        timestamp: new Date().toISOString()
      });

      // Pasar error al middleware de manejo de errores
      next(error);
    }
  },

  /**
   * Obtiene el historial de análisis de un proyecto
   */
  async getAnalysisHistory(req, res, next) {
    try {
      const { projectId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      console.log(`📋 Obteniendo historial de análisis para proyecto: ${projectId}`);

      // Aquí conectarías con tu base de datos para obtener historial
      // Por ahora simulamos respuesta
      const history = await getProjectAnalysisHistory(projectId, limit, offset);

      res.json({
        success: true,
        message: 'Historial de análisis obtenido exitosamente',
        data: {
          project_id: projectId,
          analyses: history.analyses,
          pagination: {
            total: history.total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: history.total > (parseInt(offset) + parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo historial:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo historial de análisis',
        timestamp: new Date().toISOString()
      });
      next(error);
    }
  },

  /**
   * Compara múltiples análisis de un proyecto
   */
  async compareAnalyses(req, res, next) {
    try {
      const { projectId } = req.params;
      const { analysisIds } = req.body;

      if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Se requieren al menos 2 análisis para comparar',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Comparando análisis para proyecto: ${projectId}`);

      const comparison = await compareProjectAnalyses(projectId, analysisIds);

      res.json({
        success: true,
        message: 'Comparación de análisis completada',
        data: comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en comparación:', error);
      res.status(500).json({
        success: false,
        message: 'Error comparando análisis',
        timestamp: new Date().toISOString()
      });
      next(error);
    }
  }
};

/**
 * Extrae y normaliza datos del proyecto desde el request
 */
function extractProjectData(req) {
  // Combinar datos del cuerpo del request con parámetros
  const bodyData = req.body.projectData || req.body;
  const projectId = req.params.projectId;

  return {
    id: projectId,
    name: bodyData.name || bodyData.project_name || `Proyecto ${projectId}`,
    type: bodyData.type || bodyData.project_type || 'residential',
    location: bodyData.location || bodyData.city || bodyData.region,
    area: parseFloat(bodyData.area || bodyData.built_area || bodyData.construction_area) || null,
    estimatedBudget: parseFloat(bodyData.estimatedBudget || bodyData.estimated_budget || bodyData.budget) || null,
    description: bodyData.description || bodyData.project_description,
    startDate: bodyData.startDate || bodyData.start_date,
    client: bodyData.client || bodyData.client_name,
    // Campos adicionales opcionales
    address: bodyData.address,
    floors: parseInt(bodyData.floors) || null,
    bedrooms: parseInt(bodyData.bedrooms) || null,
    bathrooms: parseInt(bodyData.bathrooms) || null
  };
}

/**
 * Valida que los datos del proyecto sean suficientes para análisis
 */
function validateProjectData(projectData) {
  const missingFields = [];
  const recommendations = [];

  // Campos obligatorios
  if (!projectData.type || projectData.type.trim() === '') {
    missingFields.push('type');
    recommendations.push('Especifique el tipo de proyecto (residencial, comercial, industrial)');
  }

  if (!projectData.location || projectData.location.trim() === '') {
    missingFields.push('location');
    recommendations.push('Indique la ubicación o ciudad del proyecto');
  }

  // Campos altamente recomendados
  if (!projectData.area || projectData.area <= 0) {
    missingFields.push('area');
    recommendations.push('Proporcione el área construida en m² para estimaciones precisas');
  }

  if (!projectData.estimatedBudget || projectData.estimatedBudget <= 0) {
    recommendations.push('Un presupuesto estimado inicial mejora la precisión del análisis');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    recommendations,
    confidenceLevel: calculateValidationConfidence(projectData)
  };
}

/**
 * Calcula nivel de confianza basado en datos disponibles
 */
function calculateValidationConfidence(projectData) {
  let score = 0;
  const maxScore = 100;

  // Campos críticos (60% del score)
  if (projectData.type) score += 20;
  if (projectData.location) score += 20;
  if (projectData.area && projectData.area > 0) score += 20;

  // Campos importantes (30% del score)
  if (projectData.estimatedBudget && projectData.estimatedBudget > 0) score += 15;
  if (projectData.description && projectData.description.length > 10) score += 10;
  if (projectData.startDate) score += 5;

  // Campos adicionales (10% del score)
  if (projectData.client) score += 5;
  if (projectData.address) score += 3;
  if (projectData.floors) score += 2;

  return Math.min(score, maxScore);
}

/**
 * Guarda análisis en base de datos (placeholder)
 */
async function saveAnalysisToDatabase(projectId, analysis, userId) {
  // TODO: Implementar guardado en base de datos
  // Estructura sugerida:
  // - project_budget_analyses table
  // - Campos: id, project_id, user_id, analysis_data (JSON), confidence_score, created_at
  
  console.log('💾 [PLACEHOLDER] Guardando análisis en BD:', {
    project_id: projectId,
    user_id: userId,
    analysis_size: JSON.stringify(analysis).length
  });

  return true; // Simular éxito
}

/**
 * Incrementa contador de uso del usuario
 */
async function incrementUserUsage(userId, actionType) {
  // TODO: Implementar tracking de uso por usuario
  // Para rate limiting y analytics
  
  console.log('📊 [PLACEHOLDER] Incrementando uso:', { user_id: userId, action: actionType });
  return true;
}

/**
 * Obtiene historial de análisis de un proyecto
 */
async function getProjectAnalysisHistory(projectId, limit, offset) {
  // TODO: Implementar query a base de datos
  
  // Simulación de respuesta
  return {
    analyses: [
      {
        id: 'analysis_001',
        created_at: '2024-01-15T10:30:00Z',
        confidence_score: 85,
        estimated_budget: 75000000,
        summary: 'Análisis inicial con factores regionales'
      },
      {
        id: 'analysis_002', 
        created_at: '2024-01-20T14:15:00Z',
        confidence_score: 92,
        estimated_budget: 78500000,
        summary: 'Análisis actualizado con datos de mercado'
      }
    ],
    total: 2
  };
}

/**
 * Compara múltiples análisis
 */
async function compareProjectAnalyses(projectId, analysisIds) {
  // TODO: Implementar lógica de comparación
  
  return {
    project_id: projectId,
    analyses_compared: analysisIds.length,
    budget_variance: {
      min: 75000000,
      max: 78500000,
      average: 76750000,
      std_deviation: 2.3
    },
    key_differences: [
      'Análisis más reciente incluye factor inflacionario',
      'Variación en costos de mano de obra por estacionalidad'
    ]
  };
}