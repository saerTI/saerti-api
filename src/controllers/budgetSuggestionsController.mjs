// src/controllers/budgetSuggestionsController.mjs
// 🔥 VERSIÓN LIMPIA - SOLO MÉTODOS UTILIZADOS EN LAS RUTAS

import { generateBudgetSuggestions, generateDetailedPdfAnalysis } from '../services/claudeService.mjs';
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

  /**
   * 🔥 MÉTODO 3: Análisis de PDF con estrategia optimizada
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 195
   */
  async analyzePdfBudget(req, res, next) {
    try {
      console.log('📄 Iniciando análisis PDF optimizado');
      
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

      const fileInfo = {
        name: req.file.originalname,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
        type: req.file.mimetype,
        sizeBytes: req.file.size
      };

      console.log('📁 Archivo recibido:', fileInfo);

      // Extracción optimizada
      let contentResult;
      try {
        console.log('🚀 Iniciando extracción optimizada...');
        
        const extractionStart = Date.now();
        
        contentResult = await PdfExtractionService.extractContent(
          req.file.buffer, 
          req.file.originalname
        );
        
        const extractionTime = Date.now() - extractionStart;
        console.log(`✅ Extracción completada en ${extractionTime}ms: ${contentResult.extraction_method}`);
        
      } catch (pdfError) {
        console.error('❌ Error en extracción PDF:', pdfError);
        
        const errorInfo = handlePdfAnalysisError(pdfError);
        return res.status(errorInfo.status).json({
          success: false,
          message: errorInfo.message,
          error_code: errorInfo.error_code,
          file_info: fileInfo,
          suggestions: [
            'Verifique que el archivo no esté corrupto',
            'Para PDFs muy grandes (>30MB), considere dividir el documento',
            'Asegúrese de que el PDF no esté protegido con contraseña'
          ],
          timestamp: new Date().toISOString()
        });
      }

      const pdfContent = contentResult.content;
      const extractionMetadata = createExtractionMetadata(contentResult);

      console.log(`📝 Contenido extraído: ${pdfContent.length} caracteres`);
      console.log(`🎯 Método de extracción: ${contentResult.extraction_method}`);

      // Análisis según método de extracción
      let analysisResult;
      
      if (contentResult.extraction_method === 'claude_vision_direct_pdf') {
        // PDF ya analizado por Claude Vision
        console.log('🎯 PDF ya analizado completamente por Claude Vision');
        
        analysisResult = {
          resumen_ejecutivo: "Análisis completado usando Claude Vision directamente sobre el PDF",
          presupuesto_estimado: contentResult.metadata?.budget_summary || { total_clp: 0 },
          materiales_detallados: contentResult.metadata?.detailed_items?.filter(item => 
            item.categoria === 'materiales' || 
            item.item?.toLowerCase().includes('material')) || [],
          mano_obra: contentResult.metadata?.detailed_items?.filter(item => 
            item.categoria === 'mano_obra' || 
            item.item?.toLowerCase().includes('mano')) || [],
          equipos_maquinaria: contentResult.metadata?.detailed_items?.filter(item => 
            item.categoria === 'equipos' || 
            item.item?.toLowerCase().includes('equipo')) || [],
          proveedores_chile: [],
          analisis_riesgos: [{
            factor: "Análisis basado en extracción automática",
            probability: "baja",
            impact: "medio",
            mitigation: "Validar datos extraídos manualmente"
          }],
          recomendaciones: [
            "Verificar precios con proveedores actuales",
            "Validar cantidades y unidades de medida",
            "Confirmar especificaciones técnicas"
          ],
          cronograma_estimado: "Requiere información adicional del proyecto",
          desglose_costos: contentResult.metadata?.totals_by_section || {},
          factores_regionales: {
            climaticos: "Considerar condiciones climáticas de la región",
            logisticos: "Evaluar costos de transporte",
            normativos: "Verificar regulaciones locales"
          },
          extraction_metadata: extractionMetadata,
          confidence_score: contentResult.confidence || 85,
          processing_method: 'claude_vision_complete'
        };
        
      } else {
        // Usar análisis tradicional con chunking
        console.log('🔄 Usando análisis tradicional con chunking...');
        
        const chunks = await createIntelligentChunks(pdfContent);
        console.log(`🧩 ${chunks.length} chunks creados para análisis`);
        
        analysisResult = await generateDetailedPdfAnalysis(
          chunks, 
          config, 
          analysisConfig,
          analysisId
        );
        
        analysisResult.extraction_metadata = extractionMetadata;
        analysisResult.processing_method = 'traditional_chunking';
      }

      // Guardar resultado
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

      // Respuesta optimizada
      res.json({
        success: true,
        message: 'Análisis PDF completado exitosamente',
        data: {
          analysisId,
          analysis: analysisResult,
          metadata: {
            originalFileSize: req.file.size,
            originalFileName: req.file.originalname,
            contentLength: pdfContent.length,
            processingTime: new Date().toISOString(),
            extraction: extractionMetadata,
            processing_method: analysisResult.processing_method
          }
        },
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Análisis PDF completado: ${extractionMetadata.extraction_method}`);

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