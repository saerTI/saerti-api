// src/controllers/budgetSuggestionsController.mjs
// 🔥 VERSIÓN LIMPIA - SOLO MÉTODOS UTILIZADOS EN LAS RUTAS

import { generateBudgetSuggestions,
  generateDetailedPdfAnalysis,
  analyzePdfWithOptimizations } from '../services/claudeService.mjs';
import config from '../config/config.mjs';
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
import { estimateApiCosts,
  estimateCostFromFileSize, } from '../services/pdfAnalysisOptimizer.mjs';

const budgetController = {
  
  /**
   * 🔥 MÉTODO 1: Análisis rápido sin ID de proyecto
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 157
   */
  async generateQuickAnalysis(req, res, next) {
    try {
      console.log('🚀 Generando análisis rápido:', req.body);
      
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

      // Usar datos directamente del request
      const projectData = {
        id: null,
        name: req.body.name || `Proyecto ${req.body.type}`,
        type: req.body.type,
        location: req.body.location,
        area: req.body.area,
        estimatedBudget: req.body.estimatedBudget,
        description: req.body.description,
        startDate: req.body.startDate,
        client: req.body.client || 'Cliente no especificado'
      };

      console.log('📊 Datos del proyecto extraídos:', projectData);

      // Validar datos del proyecto
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
        projectType: projectData.type,
        location: projectData.location
      };

      console.log('⚙️ Opciones de análisis configuradas:', analysisOptions);

      // Generar análisis
      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);

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
            name: projectData.name,
            type: projectData.type,
            location: projectData.location,
            area: projectData.area,
            estimated_budget: projectData.estimatedBudget,
            description: projectData.description
          },
          analysis_config: analysisOptions
        },
        timestamp: new Date().toISOString()
      });

      console.log('✅ Análisis rápido completado y enviado');

    } catch (error) {
      console.error('❌ Error en generateQuickAnalysis:', error);
      
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
   * 🔥 MÉTODO 2: Análisis basado en proyecto existente
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 173
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

      // Determinar fuente de datos del proyecto
      let projectData;
      
      if (req.body.type && req.body.location && req.body.area) {
        // Usar datos del request body
        projectData = {
          id: req.params.projectId,
          name: req.body.name || `Proyecto ${req.params.projectId}`,
          type: req.body.type,
          location: req.body.location,
          area: req.body.area,
          estimatedBudget: req.body.estimatedBudget,
          description: req.body.description,
          startDate: req.body.startDate,
          client: req.body.client
        };
        console.log('📊 Usando datos del request body');
      } else {
        // Buscar en base de datos
        projectData = await extractProjectData(req.params.projectId);
        console.log('📊 Datos extraídos de BD (placeholder)');
      }

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
            type: projectData.type,
            location: projectData.location,
            area: projectData.area,
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
  async executeAnalysisSimplified(file, config) {
    try {
      console.log('🚀 Iniciando análisis simplificado...');
      
      // Opción 1: Usar pdf-parse directamente (más simple)
      let extractedText = '';
      
      try {
        // Intentar con pdf-parse básico
        const pdfModule = await import('pdf-parse');
        const pdfParse = pdfModule.default;
        
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text || '';
        
        console.log(`📖 Texto extraído con pdf-parse: ${extractedText.length} caracteres`);
        
      } catch (pdfError) {
        console.warn('⚠️ pdf-parse falló, usando análisis básico:', pdfError.message);
        
        // Fallback: generar análisis con información básica del archivo
        extractedText = `ARCHIVO: ${file.originalname}
  TAMAÑO: ${(file.size / 1024 / 1024).toFixed(2)} MB
  TIPO: ${file.mimetype}

  NOTA: No se pudo extraer texto del PDF. Análisis limitado basado en metadatos del archivo.`;
      }
      
      // Si no hay texto suficiente, crear análisis básico
      if (extractedText.length < 100) {
        return {
          resumen_ejecutivo: `Análisis limitado del archivo ${file.originalname}. No se pudo extraer texto suficiente para análisis detallado.`,
          presupuesto_estimado: {
            total_clp: 0,
            materials_percentage: 0,
            labor_percentage: 0,
            equipment_percentage: 0,
            overhead_percentage: 0
          },
          materiales_detallados: [],
          mano_obra: [],
          equipos_maquinaria: [],
          proveedores_chile: [],
          analisis_riesgos: [{
            factor: 'Extracción de texto insuficiente',
            probability: 'alta',
            impact: 'alto',
            mitigation: 'Verificar que el PDF contiene texto seleccionable o usar OCR'
          }],
          recomendaciones: [
            'Verificar que el PDF no es una imagen escaneada',
            'Usar herramientas de OCR si es necesario',
            'Proporcionar archivo en formato editable (Word, Excel)'
          ],
          cronograma_estimado: 'Requiere extracción de datos exitosa',
          confidence_score: 10,
          chunks_procesados: 0,
          chunks_exitosos: 0,
          processing_method: 'basic_fallback',
          extraction_metadata: {
            extraction_method: 'failed_extraction',
            confidence: 10,
            source: 'file_metadata_only',
            content_length: extractedText.length,
            processing_time_ms: Date.now() - Date.now()
          }
        };
      }
      
      // Análisis normal con el texto extraído
      const analysisResult = await generateDetailedPdfAnalysis(extractedText, config);
      
      // Agregar metadatos
      analysisResult.extraction_metadata = {
        extraction_method: 'pdf_parse_basic',
        confidence: extractedText.length > 1000 ? 85 : 60,
        source: 'pdf_parse',
        content_length: extractedText.length,
        processing_time_ms: Date.now() - Date.now()
      };
      
      return analysisResult;
      
    } catch (error) {
      console.error('❌ Error en análisis simplificado:', error);
      throw error;
    }
  },

  /**
   * 🔥 MÉTODO 3: Análisis de PDF con estrategia optimizada
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 195
   */
  async analyzePdfBudget(req, res, next) {
    try {
      console.log('📄 Iniciando análisis PDF con optimizaciones anti-desperdicio');
      
      // Validar archivo subido
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió archivo PDF',
          error_code: 'NO_FILE',
          timestamp: new Date().toISOString()
        });
      }

      // 🔥 CORRECCIÓN: Usar función correcta para estimación
      const costEstimate = req.costEstimate || estimateCostFromFileSize(req.file.size);
      console.log(`💰 Costo estimado corregido: $${costEstimate.estimated_cost_usd?.toFixed(3) || costEstimate.toFixed(3)} USD`);

      // 🔥 CORRECCIÓN: Configuración optimizada basada en el costo
      const analysisConfig = {
        ...processAnalysisConfig(req.body),
        maxCostUsd: req.maxAllowedCost || 2.0,
        forceOptimization: true,
        anthropic: {
          model: (costEstimate.estimated_cost_usd || costEstimate) > 1.0 
            ? 'claude-3-haiku-20240307'  // Modelo más barato para archivos grandes
            : 'claude-3-haiku-20240307' // Modelo normal para archivos pequeños
        }
      };

      console.log(`🎯 Usando modelo: ${analysisConfig.anthropic.model}`);

      // 🔥 CORRECCIÓN: Ejecutar análisis con extracción incluida
      let analysisResult;
      
      try {
        // Intentar con el servicio completo
        analysisResult = await this.executeAnalysis(req.file, analysisConfig);
      } catch (extractionError) {
        console.warn('⚠️ Servicio completo falló, usando método simplificado:', extractionError.message);
        
        // Fallback al método simplificado
        analysisResult = await this.executeAnalysisSimplified(req.file, analysisConfig);
      }

      // 🔥 CORRECCIÓN: Mejorar respuesta con métricas de optimización
      const response = {
        success: true,
        message: 'Análisis PDF completado con optimizaciones',
        data: {
          analysis: analysisResult,
          metadata: {
            analysisId: analysisResult.metadata?.analysis_id || `pdf_${Date.now()}`,
            originalFileSize: req.file.size,
            originalFileName: req.file.originalname,
            contentLength: analysisResult.extraction_metadata?.content_length || 0,
            processingTime: new Date().toISOString(),
            extraction: {
              method: analysisResult.processing_method || 'optimized',
              confidence: analysisResult.confidence_score || 0,
              chunks_processed: analysisResult.chunks_procesados || 0,
              chunks_successful: analysisResult.chunks_exitosos || 0
            },
            optimization: {
              cost_estimate_usd: costEstimate.estimated_cost_usd || costEstimate,
              cost_estimate_clp: costEstimate.estimated_cost_clp || (costEstimate * 950),
              model_used: analysisConfig.anthropic.model,
              optimization_applied: true,
              cost_warning: costEstimate.cost_warning || 'N/A'
            }
          }
        },
        timestamp: new Date().toISOString()
      };

      // 📊 LOG DETALLADO PARA MONITOREO
      console.log('✅ Análisis completado:', {
        archivo: req.file.originalname,
        tamaño: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
        confianza: `${analysisResult.confidence_score}%`,
        materiales: analysisResult.materiales_detallados?.length || 0,
        mano_obra: analysisResult.mano_obra?.length || 0,
        equipos: analysisResult.equipos_maquinaria?.length || 0,
        costo_estimado: `$${(costEstimate.estimated_cost_usd || costEstimate).toFixed(3)} USD`,
        modelo: analysisConfig.anthropic.model
      });

      res.json(response);

    } catch (error) {
      console.error('❌ Error en análisis PDF optimizado:', error);

      // 🔥 MANEJO DE ERRORES MEJORADO
      let errorMessage = 'Error interno en análisis PDF';
      let errorCode = 'ANALYSIS_ERROR';

      if (error.message.includes('413') || error.message.includes('grande')) {
        errorMessage = `Archivo demasiado grande (${(req.file?.size / 1024 / 1024).toFixed(1)}MB). Máximo 20MB.`;
        errorCode = 'FILE_TOO_LARGE';
      } else if (error.message.includes('415') || error.message.includes('formato')) {
        errorMessage = 'Solo se permiten archivos PDF válidos.';
        errorCode = 'INVALID_FORMAT';
      } else if (error.message.includes('429') || error.message.includes('límite')) {
        errorMessage = 'Límite de API alcanzado. Intente en 5 minutos.';
        errorCode = 'RATE_LIMIT';
      } else if (error.message.includes('COST_LIMIT')) {
        errorMessage = error.message;
        errorCode = 'COST_LIMIT_EXCEEDED';
      } else if (error.message.includes('extractContent') || error.message.includes('PDF')) {
        errorMessage = 'Error procesando archivo PDF. Verifique que el archivo no esté corrupto.';
        errorCode = 'PDF_PROCESSING_ERROR';
      }

      res.status(error.message.includes('400') ? 400 : 500).json({
        success: false,
        message: errorMessage,
        error_code: errorCode,
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  },
  async executeAnalysis(file, config) {
    try {
      console.log('🚀 Iniciando executeAnalysis con extracción de PDF...');
      
      // 🔥 PASO 1: EXTRAER TEXTO DEL PDF usando tu servicio existente
      const contentResult = await PdfExtractionService.extractContent(file.buffer, file.originalname);
      
      if (!contentResult || !contentResult.content) {
        throw new Error('No se pudo extraer contenido del PDF');
      }
      
      const extractedText = contentResult.content;
      console.log(`📊 Texto extraído: ${extractedText.length} caracteres`);
      
      // 🔥 PASO 2: ANÁLISIS con Claude usando el texto extraído
      const analysisResult = await generateDetailedPdfAnalysis(extractedText, config);
      
      // 🔥 PASO 3: Agregar metadatos de extracción
      analysisResult.extraction_metadata = {
        extraction_method: contentResult.extraction_method || 'pdf_extraction_service',
        confidence: contentResult.confidence || 85,
        source: contentResult.source || 'pdf_parser',
        content_length: extractedText.length,
        processing_time_ms: contentResult.processing_time_ms || 0,
        pdf_type: contentResult.pdf_type || 'standard',
        items_extracted: contentResult.items_extracted || 0
      };
      
      console.log('✅ executeAnalysis completado exitosamente');
      return analysisResult;
      
    } catch (error) {
      console.error('❌ Error en executeAnalysis:', error);
      
      // Manejo específico de errores de extracción
      if (error.message.includes('extractContent') || error.message.includes('PDF')) {
        throw new Error(`Error extrayendo PDF: ${error.message}`);
      }
      
      if (error.message.includes('generateDetailedPdfAnalysis')) {
        throw new Error(`Error en análisis de contenido: ${error.message}`);
      }
      
      throw error;
    }
  },

  /**
   * 🔥 MÉTODO 4: Obtener resultado de análisis PDF
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 206
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
   * 🔥 MÉTODO 5: Comparar múltiples análisis de PDF
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 222
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
   * 🔥 MÉTODO 6: Obtener historial de análisis
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 233
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
   * 🔥 MÉTODO 7: Comparar análisis de proyecto
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 249
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

// Export default
export default budgetController;