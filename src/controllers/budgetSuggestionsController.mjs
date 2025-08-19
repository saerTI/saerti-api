// src/controllers/budgetSuggestionsController.mjs
import { generateBudgetSuggestions, generateDetailedPdfAnalysis } from '../services/claudeService.mjs';
import { PdfExtractionService } from '../services/pdfExtractionService.mjs';
import { validationResult } from 'express-validator';
import {
  extractProjectData,
  validateProjectData,
  processAnalysisConfig,
  validatePdfFile,
  createExtractionMetadata,
  handlePdfAnalysisError,
  saveAnalysisToDatabase,
  savePdfAnalysisToDatabase,
  getPdfAnalysisFromDatabase,
  incrementUserUsage,
  getProjectAnalysisHistory,
  compareProjectAnalyses,
  generatePdfComparison,
  createIntelligentChunks
} from '../utils/budgetAnalysisUtils.mjs';

export const budgetController = {
  /**
   * Genera análisis presupuestario basado en datos del proyecto
   */
  async generateAnalysis(req, res, next) {
    try {
      console.log(`📊 Iniciando análisis para proyecto: ${req.params.projectId}`);
      
      // Validaciones de entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      // Extraer y validar datos del proyecto
      const projectData = await extractProjectData(req.params.projectId);
      const validationErrors = validateProjectData(projectData);
      
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Datos del proyecto incompletos',
          errors: validationErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Configurar opciones de análisis
      const analysisOptions = {
        includeMarketRates: req.body.includeMarketRates !== false,
        includeProviders: req.body.includeProviders !== false,
        analysisDepth: req.body.analysisDepth || 'standard',
        projectType: projectData.type || 'general',
        location: projectData.location || 'Chile'
      };

      console.log('⚙️ Opciones de análisis:', analysisOptions);

      // Generar análisis usando Claude
      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);

      // Guardar en base de datos si es solicitado
      if (req.body.saveAnalysis !== false) {
        try {
          await saveAnalysisToDatabase(req.params.projectId, analysis, req.user?.id);
          console.log('💾 Análisis guardado en base de datos');
        } catch (saveError) {
          console.warn('⚠️ Error guardando análisis:', saveError.message);
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
      
      // Manejo específico de errores de API
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
   * Analiza PDF con estrategia híbrida inteligente
   */
  async analyzePdfBudget(req, res, next) {
    try {
      console.log('📄 Iniciando análisis PDF híbrido inteligente');
      
      // Validar archivo subido
      const fileErrors = validatePdfFile(req.file);
      if (fileErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: fileErrors[0],
          error_code: 'INVALID_FILE',
          timestamp: new Date().toISOString()
        });
      }

      // Validar datos adicionales del request
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
      const analysisConfig = processAnalysisConfig(req.body);

      console.log('📁 Archivo recibido:', {
        name: req.file.originalname,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
        type: req.file.mimetype
      });

      // EXTRACCIÓN HÍBRIDA INTELIGENTE
      let contentResult;
      try {
        console.log('🚀 Iniciando extracción híbrida...');
        contentResult = await PdfExtractionService.extractContent(
          req.file.buffer, 
          req.file.originalname
        );
        
        console.log(`✅ Extracción exitosa: ${contentResult.extraction_method} (${contentResult.confidence}%)`);
        
      } catch (pdfError) {
        console.error('❌ Error en extracción PDF:', pdfError);
        
        const errorInfo = handlePdfAnalysisError(pdfError);
        return res.status(errorInfo.status).json({
          success: false,
          message: errorInfo.message,
          error_code: errorInfo.error_code,
          suggestions: [
            'Verifique que el archivo no esté corrupto',
            'Para PDFs escaneados, asegúrese que las imágenes tengan buena calidad',
            'Remueva protección con contraseña si la tiene',
            'Para documentos complejos, considere dividir en archivos más pequeños'
          ],
          timestamp: new Date().toISOString()
        });
      }

      const pdfContent = contentResult.content;
      const extractionMetadata = createExtractionMetadata(contentResult);

      console.log(`📝 Contenido extraído: ${pdfContent.length} caracteres`);

      // CHUNKING INTELIGENTE
      console.log('🧩 Dividiendo contenido en chunks temáticos...');
      let chunks;
      try {
        chunks = await createIntelligentChunks(pdfContent);
        console.log(`🧩 ${chunks.length} chunks temáticos creados`);
      } catch (chunkError) {
        console.error('❌ Error en chunking:', chunkError);
        // Fallback: chunk único
        chunks = [{
          type: 'general',
          content: pdfContent.substring(0, 8000),
          title: 'Contenido General'
        }];
        console.log('📝 Usando chunk único como fallback');
      }

      // ANÁLISIS DETALLADO CON IA
      console.log('🤖 Iniciando análisis con IA...');
      let analysisResult;
      try {
        analysisResult = await generateDetailedPdfAnalysis(
          chunks, 
          analysisConfig, 
          analysisId
        );
        
        // Agregar metadata de extracción
        analysisResult.extraction_metadata = extractionMetadata;
        
      } catch (aiError) {
        console.error('❌ Error en análisis IA:', aiError);
        
        const errorInfo = handlePdfAnalysisError(aiError);
        return res.status(errorInfo.status).json({
          success: false,
          message: errorInfo.message,
          error_code: errorInfo.error_code,
          retry_after: errorInfo.retry_after,
          timestamp: new Date().toISOString()
        });
      }

      // GUARDAR RESULTADO
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

      // RESPUESTA EXITOSA
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
            contentLength: pdfContent.length,
            processingTime: new Date().toISOString(),
            extraction: extractionMetadata
          }
        },
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Análisis PDF completado: ${extractionMetadata.extraction_method} -> ${chunks.length} chunks -> IA`);

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
      
      if (!analysisId) {
        return res.status(400).json({
          success: false,
          message: 'ID de análisis requerido',
          error_code: 'MISSING_ANALYSIS_ID',
          timestamp: new Date().toISOString()
        });
      }

      const analysis = await getPdfAnalysisFromDatabase(analysisId);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Análisis no encontrado',
          error_code: 'ANALYSIS_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Análisis recuperado exitosamente',
        data: analysis,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo análisis PDF:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno obteniendo análisis',
        error_code: 'RETRIEVAL_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  },

  /**
   * Compara múltiples análisis de PDF
   */
  async comparePdfAnalyses(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { analysisIds, comparisonType = 'total_cost' } = req.body;
      const comparison = await generatePdfComparison(analysisIds, comparisonType);

      res.json({
        success: true,
        message: 'Comparación completada exitosamente',
        data: comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en comparación PDF:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno en comparación',
        error_code: 'COMPARISON_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  },

  /**
   * Obtiene historial de análisis de un proyecto
   */
  async getAnalysisHistory(req, res, next) {
    try {
      const { projectId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const history = await getProjectAnalysisHistory(projectId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        message: 'Historial recuperado exitosamente',
        data: history,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error obteniendo historial:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno obteniendo historial',
        error_code: 'HISTORY_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  },

  /**
   * Compara múltiples análisis de un proyecto específico
   */
  async compareProjectAnalyses(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { projectId } = req.params;
      const { analysisIds, comparisonType = 'total_cost' } = req.body;

      const comparison = await compareProjectAnalyses(projectId, analysisIds, comparisonType);

      res.json({
        success: true,
        message: 'Comparación de proyecto completada exitosamente',
        data: comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error en comparación de proyecto:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno en comparación de proyecto',
        error_code: 'PROJECT_COMPARISON_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  }
};

export default budgetController;