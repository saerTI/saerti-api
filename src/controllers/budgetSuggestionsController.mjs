// src/controllers/budgetSuggestionsController.mjs - CÓDIGO COMPLETO CORREGIDO

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

/**
 * 🔥 FUNCIÓN NUEVA: Calcular presupuesto de manera consistente con metodología chilena
 */
const calcularPresupuestoCompleto = (materiales, manoObra, equipos, subcontratos = 0) => {
  console.log('📊 Calculando presupuesto con valores:', {
    materiales,
    manoObra, 
    equipos,
    subcontratos
  });

  // PASO 1: Costos directos
  const costosDirectos = {
    materiales,
    manoObra,
    equipos,
    subcontratos,
    total: materiales + manoObra + equipos + subcontratos
  };

  console.log('💰 Costos directos calculados:', costosDirectos);

  // PASO 2: Costos indirectos (metodología estándar chilena)
  // Gastos generales: 12% sobre costos directos SOLAMENTE
  const gastosGenerales = costosDirectos.total * 0.12;
  
  // Utilidad: 10% sobre (costos directos + gastos generales)
  const baseUtilidad = costosDirectos.total + gastosGenerales;
  const utilidad = baseUtilidad * 0.10;
  
  // Contingencia: 5% sobre costos directos
  const contingencia = costosDirectos.total * 0.05;

  const costosIndirectos = {
    gastosGenerales,
    utilidad,
    contingencia,
    total: gastosGenerales + utilidad + contingencia
  };

  console.log('📈 Costos indirectos calculados:', costosIndirectos);

  // PASO 3: Presupuesto final
  const subtotal = costosDirectos.total + costosIndirectos.total;
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  const presupuestoFinal = {
    subtotal,
    iva,
    total,
    totalUF: total / 36000,
    precioM2: total / 100 // Por defecto 100m²
  };

  console.log('✅ Presupuesto final calculado:', presupuestoFinal);

  return {
    costosDirectos,
    costosIndirectos,
    presupuestoFinal
  };
};

/**
 * 🔥 FUNCIÓN NUEVA: Procesar y corregir análisis PDF con cálculos consistentes
 */
const procesarYCorregirAnalisis = (analysisResult) => {
  try {
    console.log('🔍 Procesando análisis para corrección de cálculos...');

    // Calcular totales reales sumando los items
    const materialesTotal = analysisResult.materiales_detallados?.reduce(
      (sum, item) => sum + (item.subtotal || 0), 0
    ) || 0;

    const manoObraTotal = analysisResult.mano_obra?.reduce(
      (sum, item) => sum + (item.subtotal || 0), 0
    ) || 0;

    const equiposTotal = analysisResult.equipos_maquinaria?.reduce(
      (sum, item) => sum + (item.subtotal || 0), 0
    ) || 0;

    console.log('📊 Totales reales calculados:', {
      materiales: materialesTotal,
      manoObra: manoObraTotal,
      equipos: equiposTotal
    });

    // Usar la función de cálculo corregida
    const presupuestoCorregido = calcularPresupuestoCompleto(
      materialesTotal,
      manoObraTotal,
      equiposTotal,
      0 // subcontratos
    );

    // Actualizar el analysis con los valores corregidos
    const analysisCorrected = {
      ...analysisResult,
      // ✅ CORREGIR: presupuesto_estimado debe usar el total real
      presupuesto_estimado: {
        total_clp: presupuestoCorregido.presupuestoFinal.total,
        materials_percentage: materialesTotal > 0 ? (materialesTotal / presupuestoCorregido.costosDirectos.total) * 100 : 0,
        labor_percentage: manoObraTotal > 0 ? (manoObraTotal / presupuestoCorregido.costosDirectos.total) * 100 : 0,
        equipment_percentage: equiposTotal > 0 ? (equiposTotal / presupuestoCorregido.costosDirectos.total) * 100 : 0,
        overhead_percentage: presupuestoCorregido.costosDirectos.total > 0 ? (presupuestoCorregido.costosIndirectos.total / presupuestoCorregido.costosDirectos.total) * 100 : 0
      },
      // ✅ CORREGIR: desglose_costos debe ser consistente
      desglose_costos: {
        materiales: materialesTotal,
        mano_obra: manoObraTotal,
        equipos: equiposTotal,
        gastos_generales: presupuestoCorregido.costosIndirectos.gastosGenerales,
        utilidad: presupuestoCorregido.costosIndirectos.utilidad,
        contingencia: presupuestoCorregido.costosIndirectos.contingencia,
        subtotal: presupuestoCorregido.presupuestoFinal.subtotal,
        iva: presupuestoCorregido.presupuestoFinal.iva,
        total: presupuestoCorregido.presupuestoFinal.total
      }
    };

    console.log('✅ Análisis corregido:', {
      total_original: analysisResult.presupuesto_estimado?.total_clp,
      total_corregido: analysisCorrected.presupuesto_estimado.total_clp,
      diferencia: analysisCorrected.presupuesto_estimado.total_clp - (analysisResult.presupuesto_estimado?.total_clp || 0)
    });

    return analysisCorrected;

  } catch (error) {
    console.error('❌ Error procesando análisis:', error);
    return analysisResult; // Devolver original si hay error
  }
};

/**
 * 🔥 FUNCIÓN NUEVA: Validar consistencia de presupuesto
 */
const validarConsistenciaPresupuesto = (analysis) => {
  const warnings = [];
  
  const totalDirecto = (analysis.desglose_costos?.materiales || 0) + 
                      (analysis.desglose_costos?.mano_obra || 0) + 
                      (analysis.desglose_costos?.equipos || 0);
  
  const totalPresupuesto = analysis.presupuesto_estimado?.total_clp || 0;
  const totalDesglose = analysis.desglose_costos?.total || 0;
  
  if (Math.abs(totalPresupuesto - totalDesglose) > 1000) {
    warnings.push(`Inconsistencia en totales: presupuesto_estimado=${totalPresupuesto}, desglose_costos=${totalDesglose}`);
  }
  
  if (totalDirecto === 0) {
    warnings.push('No se encontraron costos directos válidos');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Advertencias de validación:', warnings);
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
    totals: {
      directo: totalDirecto,
      presupuesto: totalPresupuesto,
      desglose: totalDesglose
    }
  };
};

const budgetController = {
  
  /**
   * 🔥 MÉTODO 1: Análisis rápido sin ID de proyecto
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 157
   */
  async generateQuickAnalysis(req, res, next) {
    try {
      console.log('🚀 Generando análisis rápido:', req.body);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

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

      const validationErrors = validateProjectData(projectData);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Datos del proyecto incompletos',
          errors: validationErrors,
          timestamp: new Date().toISOString()
        });
      }

      const analysisOptions = {
        includeMarketRates: req.body.includeMarketRates !== false,
        includeProviders: req.body.includeProviders !== false,
        analysisDepth: req.body.analysisDepth || 'standard',
        projectType: projectData.type,
        location: projectData.location
      };

      console.log('⚙️ Opciones de análisis configuradas:', analysisOptions);

      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);

      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'budget_analysis');
      }

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
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      let projectData;
      
      if (req.body.type && req.body.location && req.body.area) {
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

      const analysisOptions = {
        includeMarketRates: req.body.includeMarketRates !== false,
        includeProviders: req.body.includeProviders !== false,
        analysisDepth: req.body.analysisDepth || 'standard',
        projectType: projectData.type || 'general',
        location: projectData.location || 'Chile'
      };

      console.log('⚙️ Opciones de análisis:', analysisOptions);

      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);

      if (req.body.saveAnalysis !== false) {
        try {
          await saveAnalysisToDatabase(req.params.projectId, analysis, req.user?.id);
          console.log('💾 Análisis guardado en base de datos');
        } catch (saveError) {
          console.warn('⚠️ Error guardando análisis:', saveError.message);
        }
      }

      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'budget_analysis');
      }

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
   * 🔥 MÉTODO 3: Ejecutar análisis simplificado (fallback)
   */
  async executeAnalysisSimplified(file, config) {
    try {
      console.log('🚀 Iniciando análisis simplificado...');
      
      let extractedText = '';
      
      try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = pdfModule.default;
        
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text || '';
        
        console.log(`📖 Texto extraído con pdf-parse: ${extractedText.length} caracteres`);
        
      } catch (pdfError) {
        console.warn('⚠️ pdf-parse falló, usando análisis básico:', pdfError.message);
        
        extractedText = `ARCHIVO: ${file.originalname}
TAMAÑO: ${(file.size / 1024 / 1024).toFixed(2)} MB
TIPO: ${file.mimetype}

NOTA: No se pudo extraer texto del PDF. Análisis limitado basado en metadatos del archivo.`;
      }
      
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
      
      const analysisResult = await generateDetailedPdfAnalysis(extractedText, config);
      
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
   * 🔥 MÉTODO 4: Ejecutar análisis completo con extracción
   */
  async executeAnalysis(file, config) {
    try {
      console.log('🚀 Iniciando executeAnalysis con extracción de PDF...');
      
      const contentResult = await PdfExtractionService.extractContent(file.buffer, file.originalname);
      
      if (!contentResult || !contentResult.content) {
        throw new Error('No se pudo extraer contenido del PDF');
      }
      
      const extractedText = contentResult.content;
      console.log(`📊 Texto extraído: ${extractedText.length} caracteres`);
      
      const analysisResult = await generateDetailedPdfAnalysis(extractedText, config);
      
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
   * 🔥 MÉTODO 5: Análisis de PDF con estrategia optimizada - FUNCIÓN COMPLETA CORREGIDA
   * ✅ SE USA en budgetSuggestionsRoutes.mjs línea 195
   */
  async analyzePdfBudget(req, res, next) {
    const startTime = Date.now();
    
    try {
      console.log('📄 Iniciando análisis PDF con optimizaciones anti-desperdicio');
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió archivo PDF',
          error_code: 'NO_FILE',
          timestamp: new Date().toISOString()
        });
      }

      console.log('✅ Archivo PDF recibido correctamente:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      const costEstimate = req.costEstimate || estimateCostFromFileSize(req.file.size);
      console.log(`💰 Costo estimado: $${(costEstimate.estimated_cost_usd || costEstimate).toFixed(3)} USD`);

      const analysisConfig = {
        ...processAnalysisConfig(req.body),
        maxCostUsd: req.maxAllowedCost || 2.0,
        forceOptimization: true,
        anthropic: {
          model: (costEstimate.estimated_cost_usd || costEstimate) > 1.0 
            ? 'claude-3-haiku-20240307'  
            : 'claude-3-haiku-20240307' 
        }
      };

      console.log(`🎯 Usando modelo: ${analysisConfig.anthropic.model}`);

      let analysisResult;
      
      try {
        analysisResult = await this.executeAnalysis(req.file, analysisConfig);
        console.log('✅ Análisis completo exitoso');
      } catch (extractionError) {
        console.warn('⚠️ Servicio completo falló, usando método simplificado:', extractionError.message);
        
        analysisResult = await this.executeAnalysisSimplified(req.file, analysisConfig);
        console.log('✅ Análisis simplificado exitoso');
      }

      // 🔥 NUEVO: PROCESAR Y CORREGIR análisis con cálculos consistentes
      console.log('🔧 Aplicando correcciones de cálculo...');
      const correctedAnalysis = procesarYCorregirAnalisis(analysisResult);
      
      // 🔥 VALIDAR consistencia
      const validation = validarConsistenciaPresupuesto(correctedAnalysis);
      if (!validation.isValid) {
        console.warn('⚠️ Advertencias de validación:', validation.warnings);
      }

      const response = {
        success: true,
        message: 'Análisis PDF completado con optimizaciones',
        data: {
          analysis: correctedAnalysis, // ✅ Usar análisis corregido
          metadata: {
            analysisId: correctedAnalysis.metadata?.analysis_id || `pdf_${Date.now()}`,
            originalFileSize: req.file.size,
            originalFileName: req.file.originalname,
            contentLength: correctedAnalysis.extraction_metadata?.content_length || 0,
            processingTime: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            extraction: {
              method: correctedAnalysis.processing_method || 'optimized',
              confidence: correctedAnalysis.confidence_score || 0,
              chunks_processed: correctedAnalysis.chunks_procesados || 0,
              chunks_successful: correctedAnalysis.chunks_exitosos || 0
            },
            optimization: {
              cost_estimate_usd: costEstimate.estimated_cost_usd || costEstimate,
              cost_estimate_clp: costEstimate.estimated_cost_clp || ((costEstimate.estimated_cost_usd || costEstimate) * 950),
              model_used: analysisConfig.anthropic.model,
              optimization_applied: true,
              cost_warning: costEstimate.cost_warning || 'Optimizado exitosamente'
            },
            validation: validation
          }
        },
        timestamp: new Date().toISOString()
      };

      console.log('✅ Análisis PDF completado:', {
        tiempo: `${Date.now() - startTime}ms`,
        costo: `$${(costEstimate.estimated_cost_usd || costEstimate).toFixed(3)} USD`,
        archivo: req.file.originalname
      });

      res.json(response);

    } catch (error) {
      console.error('❌ Error en análisis PDF optimizado:', error);

      let errorMessage = 'Error interno en análisis PDF';
      let errorCode = 'ANALYSIS_ERROR';
      let statusCode = 500;

      if (error.message.includes('413') || error.message.includes('grande')) {
        errorMessage = `Archivo demasiado grande (${(req.file?.size / 1024 / 1024).toFixed(1)}MB). Máximo 20MB.`;
        errorCode = 'FILE_TOO_LARGE';
        statusCode = 413;
      } else if (error.message.includes('415') || error.message.includes('formato')) {
        errorMessage = 'Solo se permiten archivos PDF válidos.';
        errorCode = 'INVALID_FORMAT';
        statusCode = 415;
      } else if (error.message.includes('429') || error.message.includes('límite')) {
        errorMessage = 'Límite de API alcanzado. Intente en 5 minutos.';
        errorCode = 'RATE_LIMIT';
        statusCode = 429;
      } else if (error.message.includes('COST_LIMIT')) {
        errorMessage = error.message;
        errorCode = 'COST_LIMIT_EXCEEDED';
        statusCode = 400;
      } else if (error.message.includes('extractContent') || error.message.includes('PDF')) {
        errorMessage = 'Error procesando archivo PDF. Verifique que el archivo no esté corrupto.';
        errorCode = 'PDF_PROCESSING_ERROR';
        statusCode = 400;
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
  },

  /**
   * 🔥 MÉTODO 6: Obtener resultado de análisis PDF
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

      console.log(`🔍 Buscando análisis: ${analysisId}`);

      const analysis = await getPdfAnalysisFromDatabase(analysisId);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Análisis no encontrado',
          error_code: 'ANALYSIS_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const correctedAnalysis = procesarYCorregirAnalisis(analysis);

      res.json({
        success: true,
        message: 'Análisis recuperado exitosamente',
        data: correctedAnalysis,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Análisis entregado exitosamente');

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
   * 🔥 MÉTODO 7: Comparar múltiples análisis de PDF
   */
  async comparePdfAnalyses(req, res, next) {
    try {
      console.log('🔍 Iniciando comparación de análisis PDF');

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

      console.log(`📊 Comparando ${analysisIds.length} análisis por ${comparisonType}`);

      const comparison = await generatePdfComparison(analysisIds, comparisonType);

      if (comparison.analyses) {
        comparison.analyses = comparison.analyses.map(analysis => 
          procesarYCorregirAnalisis(analysis)
        );
      }

      res.json({
        success: true,
        message: 'Comparación completada exitosamente',
        data: comparison,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Comparación completada');

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
   * 🔥 MÉTODO 8: Obtener historial de análisis
   */
  async getAnalysisHistory(req, res, next) {
    try {
      const { projectId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      console.log(`📚 Obteniendo historial para proyecto: ${projectId}`);

      const history = await getProjectAnalysisHistory(projectId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      if (history.analyses) {
        history.analyses = history.analyses.map(analysis => 
          procesarYCorregirAnalisis(analysis)
        );
      }

      res.json({
        success: true,
        message: 'Historial recuperado exitosamente',
        data: history,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Historial entregado');

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
   * 🔥 MÉTODO 9: Comparar análisis de proyecto
   */
  async compareProjectAnalyses(req, res, next) {
    try {
      console.log('🔍 Iniciando comparación de análisis de proyecto');

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

      console.log(`📊 Comparando análisis del proyecto ${projectId}`);

      const comparison = await compareProjectAnalyses(projectId, analysisIds, comparisonType);

      if (comparison.analyses) {
        comparison.analyses = comparison.analyses.map(analysis => 
          procesarYCorregirAnalisis(analysis)
        );
      }

      res.json({
        success: true,
        message: 'Comparación de proyecto completada exitosamente',
        data: comparison,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Comparación de proyecto completada');

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
  },

  /**
   * 🔥 MÉTODO 10: Validar archivo PDF antes del análisis (NUEVO)
   */
  async validatePdfFile(req, res, next) {
    try {
      console.log('🔍 Validando archivo PDF antes del análisis');

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió archivo PDF',
          error_code: 'NO_FILE',
          timestamp: new Date().toISOString()
        });
      }

      const validation = validatePdfFile(req.file);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error,
          error_code: 'INVALID_FILE',
          timestamp: new Date().toISOString()
        });
      }

      const costEstimate = estimateCostFromFileSize(req.file.size);

      res.json({
        success: true,
        message: 'Archivo válido',
        data: {
          isValid: true,
          warnings: validation.warnings || [],
          costEstimate: {
            estimated_cost_usd: costEstimate.estimated_cost_usd || costEstimate,
            estimated_cost_clp: costEstimate.estimated_cost_clp || ((costEstimate.estimated_cost_usd || costEstimate) * 950),
            cost_warning: costEstimate.cost_warning || 'Costo estimado normal',
            chunks_to_process: Math.ceil(req.file.size / (1024 * 1024 * 2))
          },
          recommendation: validation.isValid && (validation.warnings?.length || 0) === 0 
            ? 'ARCHIVO_OPTIMO_PARA_ANALISIS' 
            : 'ARCHIVO_MEDIO_PROCEDER_CON_CUIDADO'
        },
        timestamp: new Date().toISOString()
      });

      console.log('✅ Validación completada');

    } catch (error) {
      console.error('❌ Error en validación de archivo:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error interno en validación',
        error_code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });

      next(error);
    }
  }
};

/**
 * 🔥 FUNCIONES DE UTILIDAD ADICIONALES
 */

/**
 * Función para generar reporte de análisis (para uso interno)
 */
budgetController.generateAnalysisReport = async (analysisId) => {
  try {
    console.log(`📋 Generando reporte para análisis: ${analysisId}`);
    
    const analysis = await getPdfAnalysisFromDatabase(analysisId);
    if (!analysis) {
      throw new Error('Análisis no encontrado');
    }

    const correctedAnalysis = procesarYCorregirAnalisis(analysis);
    const validation = validarConsistenciaPresupuesto(correctedAnalysis);

    return {
      analysis: correctedAnalysis,
      validation,
      report_metadata: {
        generated_at: new Date().toISOString(),
        analysis_id: analysisId,
        version: '1.0'
      }
    };

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
    throw error;
  }
};

/**
 * Función para obtener estadísticas de análisis (para dashboards)
 */
budgetController.getAnalysisStats = async (userId, timeframe = '30d') => {
  try {
    console.log(`📊 Obteniendo estadísticas para usuario: ${userId}`);
    
    // Aquí iría la lógica para obtener estadísticas de la base de datos
    // Por ahora devolvemos datos de ejemplo
    
    return {
      total_analyses: 0,
      successful_analyses: 0,
      average_confidence: 0,
      total_cost_estimated: 0,
      timeframe,
      last_updated: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
};

/**
 * Función para limpiar análisis antiguos (para mantenimiento)
 */
budgetController.cleanupOldAnalyses = async (daysOld = 30) => {
  try {
    console.log(`🧹 Limpiando análisis de más de ${daysOld} días`);
    
    // Aquí iría la lógica para limpiar análisis antiguos
    // Por ahora solo retornamos un resultado de ejemplo
    
    return {
      cleaned: 0,
      message: `Análisis de más de ${daysOld} días eliminados`,
      cleaned_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    throw error;
  }
};

// Export default
export default budgetController;