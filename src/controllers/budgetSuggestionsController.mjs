// src/controllers/budgetSuggestionsController.mjs
import { generateBudgetSuggestions, generateDetailedPdfAnalysis } from '../services/claudeService.mjs';
import { validationResult } from 'express-validator';

// ✅ IMPORT DINÁMICO PARA EVITAR ERRORES DE INICIALIZACIÓN
let pdfParse;
try {
  const pdfModule = await import('pdf-parse');
  pdfParse = pdfModule.default;
} catch (error) {
  console.error('❌ Error cargando pdf-parse:', error);
  // Fallback: usar una función que lance error descriptivo
  pdfParse = () => {
    throw new Error('PDF parsing no disponible. Instale pdf-parse@1.1.1');
  };
}

import {
  extractProjectData,
  validateProjectData,
  saveAnalysisToDatabase,
  savePdfAnalysisToDatabase,
  getPdfAnalysisFromDatabase,
  incrementUserUsage,
  getProjectAnalysisHistory,
  compareProjectAnalyses,
  generatePdfComparison,
  createIntelligentChunks
} from '../utils/budgetAnalysisUtils.mjs';

/**
 * Función auxiliar para extraer texto PDF con manejo robusto de errores
 */
async function extractPdfText(buffer) {
  if (!pdfParse || typeof pdfParse !== 'function') {
    throw new Error('PDF parsing service not available');
  }

  try {
    console.log('📝 Extrayendo texto del PDF...');
    const pdfData = await pdfParse(buffer);
    
    if (!pdfData || !pdfData.text) {
      throw new Error('No se pudo extraer texto del PDF');
    }
    
    const textLength = pdfData.text.length;
    console.log(`📝 Texto extraído: ${textLength} caracteres`);
    
    if (textLength < 100) {
      throw new Error('PDF contiene muy poco texto (posiblemente solo imágenes)');
    }
    
    return pdfData.text;
  } catch (error) {
    console.error('❌ Error en extracción PDF:', error);
    
    // Mejorar mensajes de error para el usuario
    if (error.message.includes('not available')) {
      throw new Error('Servicio de análisis PDF temporalmente no disponible');
    }
    
    if (error.message.includes('Invalid PDF')) {
      throw new Error('Archivo PDF corrupto o inválido');
    }
    
    if (error.message.includes('Password')) {
      throw new Error('PDF protegido con contraseña no soportado');
    }
    
    throw new Error('Error procesando archivo PDF. Verifique que el archivo no esté dañado');
  }
}

/**
 * Controlador para generar sugerencias presupuestarias con IA
 */
export default {
  /**
   * Genera análisis presupuestario para un proyecto
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
        includeMarketData: req.body.includeMarketData !== false,
        includeHistoricalData: req.body.includeHistoricalData || false,
        analysisDepth: req.body.analysisDepth || 'standard'
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
          retry_after: 300,
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

      next(error);
    }
  },

  /**
   * Analiza un PDF de presupuesto usando chunking inteligente
   */
  async analyzePdfBudget(req, res, next) {
    try {
      console.log('📄 Iniciando análisis PDF de presupuesto');
      
      // ✅ VALIDACIONES BÁSICAS
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió archivo PDF',
          error_code: 'NO_FILE_RECEIVED',
          timestamp: new Date().toISOString()
        });
      }

      if (!req.file.mimetype || req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          message: 'Solo se permiten archivos PDF',
          error_code: 'INVALID_FILE_TYPE',
          timestamp: new Date().toISOString()
        });
      }

      if (req.file.size > 15 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          message: 'Archivo demasiado grande. Máximo 15MB permitido',
          error_code: 'FILE_TOO_LARGE',
          timestamp: new Date().toISOString()
        });
      }

      // Validar datos de entrada adicionales
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const analysisId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Configuración de análisis
      const analysisConfig = {
        depth: req.body.analysisDepth || 'standard',
        includeProviders: req.body.includeProviders !== false,
        projectType: req.body.projectType || 'unknown',
        projectLocation: req.body.projectLocation || 'Chile',
        maxCostEstimate: req.body.maxCostEstimate || null
      };

      console.log('⚙️ Configuración de análisis:', analysisConfig);
      console.log('📁 Archivo recibido:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // ✅ EXTRACCIÓN DE TEXTO CON MANEJO ROBUSTO
      let pdfText;
      try {
        pdfText = await extractPdfText(req.file.buffer);
      } catch (pdfError) {
        console.error('❌ Error extrayendo texto PDF:', pdfError);
        
        return res.status(400).json({
          success: false,
          message: pdfError.message,
          error_code: 'PDF_PROCESSING_ERROR',
          suggestions: [
            'Verifique que el archivo no esté corrupto',
            'Asegúrese que el PDF contiene texto legible',
            'PDFs escaneados como imagen no son soportados',
            'Remueva protección con contraseña si la tiene'
          ],
          timestamp: new Date().toISOString()
        });
      }

      // ✅ CHUNKING INTELIGENTE
      console.log('🧩 Dividiendo PDF en chunks temáticos...');
      let chunks;
      try {
        chunks = await createIntelligentChunks(pdfText);
        console.log(`🧩 PDF dividido en ${chunks.length} chunks temáticos`);
      } catch (chunkError) {
        console.error('❌ Error en chunking:', chunkError);
        return res.status(500).json({
          success: false,
          message: 'Error procesando contenido del PDF',
          error_code: 'CHUNK_PROCESSING_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      // ✅ ANÁLISIS CON IA
      console.log('🤖 Iniciando análisis con IA...');
      let analysisResult;
      try {
        analysisResult = await generateDetailedPdfAnalysis(
          chunks, 
          analysisConfig, 
          analysisId
        );
      } catch (aiError) {
        console.error('❌ Error en análisis IA:', aiError);
        
        if (aiError.message.includes('API key')) {
          return res.status(503).json({
            success: false,
            message: 'Servicio de análisis IA temporalmente no disponible',
            error_code: 'AI_SERVICE_UNAVAILABLE',
            timestamp: new Date().toISOString()
          });
        }
        
        if (aiError.message.includes('rate limit')) {
          return res.status(429).json({
            success: false,
            message: 'Límite de análisis alcanzado. Intente nuevamente en unos minutos',
            error_code: 'RATE_LIMIT_EXCEEDED',
            retry_after: 300,
            timestamp: new Date().toISOString()
          });
        }
        
        return res.status(500).json({
          success: false,
          message: 'Error en análisis con IA',
          error_code: 'AI_ANALYSIS_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      // ✅ GUARDAR RESULTADO
      if (req.body.saveAnalysis !== false) {
        try {
          await savePdfAnalysisToDatabase(analysisId, analysisResult, req.user?.id);
          console.log('💾 Análisis PDF guardado en base de datos');
        } catch (saveError) {
          console.warn('⚠️ Error guardando análisis PDF:', saveError.message);
        }
      }

      // Incrementar contador de uso
      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'pdf_analysis');
      }

      // ✅ RESPUESTA EXITOSA
      res.json({
        success: true,
        message: 'Análisis PDF completado exitosamente',
        data: {
          analysisId,
          analysis: analysisResult,
          metadata: {
            chunksProcessed: chunks.length,
            originalFileSize: req.file.size,
            originalFileName: req.file.originalname,
            textLength: pdfText.length,
            processingTime: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      });

      console.log('✅ Análisis PDF completado exitosamente');

    } catch (error) {
      console.error('❌ Error crítico en analyzePdfBudget:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno en análisis PDF',
        error_code: 'CRITICAL_PDF_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  },

  /**
   * Obtiene resultado de análisis PDF por ID
   */
  async getPdfAnalysisResult(req, res, next) {
    try {
      const { analysisId } = req.params;
      
      if (!analysisId || !analysisId.startsWith('pdf_')) {
        return res.status(400).json({
          success: false,
          message: 'ID de análisis inválido',
          timestamp: new Date().toISOString()
        });
      }
      
      const analysisResult = await getPdfAnalysisFromDatabase(analysisId, req.user?.id);
      
      if (!analysisResult) {
        return res.status(404).json({
          success: false,
          message: 'Análisis no encontrado',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: analysisResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en getPdfAnalysisResult:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo análisis PDF',
        timestamp: new Date().toISOString()
      });
      next(error);
    }
  },

  /**
   * Compara análisis de múltiples PDFs
   */
  async comparePdfAnalyses(req, res, next) {
    try {
      const { analysisIds, comparisonType = 'total_cost' } = req.body;
      
      if (!analysisIds || !Array.isArray(analysisIds) || analysisIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Se necesitan al menos 2 análisis para comparar',
          timestamp: new Date().toISOString()
        });
      }

      if (analysisIds.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Máximo 5 análisis pueden ser comparados',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obtener todos los análisis
      const analyses = await Promise.all(
        analysisIds.map(id => getPdfAnalysisFromDatabase(id, req.user?.id))
      );

      // Filtrar análisis válidos
      const validAnalyses = analyses.filter(Boolean);
      
      if (validAnalyses.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Se necesitan al menos 2 análisis válidos para comparar',
          timestamp: new Date().toISOString()
        });
      }

      // Generar comparación
      const comparison = await generatePdfComparison(validAnalyses, comparisonType);

      // Incrementar contador de uso
      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'pdf_comparison');
      }

      res.json({
        success: true,
        data: comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en comparePdfAnalyses:', error);
      res.status(500).json({
        success: false,
        message: 'Error comparando análisis PDF',
        timestamp: new Date().toISOString()
      });
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

      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return res.status(400).json({
          success: false,
          message: 'Limit debe ser un número entre 1 y 50',
          timestamp: new Date().toISOString()
        });
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Offset debe ser un número mayor o igual a 0',
          timestamp: new Date().toISOString()
        });
      }

      const history = await getProjectAnalysisHistory(projectId, limitNum, offsetNum);

      res.json({
        success: true,
        message: 'Historial de análisis obtenido exitosamente',
        data: {
          project_id: projectId,
          analyses: history.analyses,
          pagination: {
            total: history.total,
            limit: limitNum,
            offset: offsetNum,
            has_more: history.total > (offsetNum + limitNum)
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

      if (analysisIds.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Máximo 10 análisis pueden ser comparados',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`🔍 Comparando análisis para proyecto: ${projectId}`);

      const comparison = await compareProjectAnalyses(projectId, analysisIds);

      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'analysis_comparison');
      }

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