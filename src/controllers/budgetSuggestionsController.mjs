// src/controllers/budgetSuggestionsController.mjs
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
   * 🔥 NUEVA FUNCIÓN: Análisis rápido sin ID de proyecto
   * Usa datos directamente del request body
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

      // 🔥 USAR DATOS DIRECTAMENTE DEL REQUEST en lugar de extraer de BD
      const projectData = {
        id: null, // No hay ID para análisis rápido
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

      // 🔥 GENERAR ANÁLISIS USANDO DATOS REALES
      const analysis = await generateBudgetSuggestions(projectData, analysisOptions);

      // Incrementar contador de uso del usuario
      if (req.user?.id) {
        await incrementUserUsage(req.user.id, 'budget_analysis');
      }

      // 🔥 RESPUESTA CON DATOS CORRECTOS
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
   * Genera análisis presupuestario basado en datos del proyecto existente
   * (mantiene funcionalidad original para proyectos guardados)
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

      // 🔥 MEJORAR: Si hay datos en el body, usarlos; sino buscar en BD
      let projectData;
      
      if (req.body.type && req.body.location && req.body.area) {
        // Usar datos del request body (análisis directo)
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
        // Buscar en base de datos (funcionalidad existente)
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
   * Analiza PDF con estrategia híbrida inteligente
   */
  async analyzePdfBudget(req, res, next) {
    try {
      console.log('📄 Iniciando análisis PDF optimizado para documentos largos');
      
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

      // 🔥 EXTRACCIÓN OPTIMIZADA PARA PDFs LARGOS
      let contentResult;
      try {
        console.log('🚀 Iniciando extracción optimizada...');
        
        // Medir tiempo de extracción
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
            'Asegúrese de que el PDF no esté protegido con contraseña',
            'Para documentos escaneados, verifique la calidad de las imágenes'
          ],
          timestamp: new Date().toISOString()
        });
      }

      const pdfContent = contentResult.content;
      const extractionMetadata = createExtractionMetadata(contentResult);

      console.log(`📝 Contenido extraído: ${pdfContent.length} caracteres`);
      console.log(`🎯 Método de extracción: ${contentResult.extraction_method}`);

      // 🔥 ANÁLISIS INTELIGENTE SEGÚN EL MÉTODO DE EXTRACCIÓN
      let analysisResult;
      
      if (contentResult.extraction_method === 'claude_vision_direct_pdf') {
        // PDF analizado completamente por Claude Vision
        console.log('🎯 PDF ya analizado completamente por Claude Vision');
        
        analysisResult = {
          resumen_ejecutivo: this.generateExecutiveSummary(contentResult.metadata),
          presupuesto_estimado: contentResult.metadata?.budget_summary || {},
          materiales_detallados: this.extractMaterials(contentResult.metadata?.detailed_items || []),
          mano_obra: this.extractLabor(contentResult.metadata?.detailed_items || []),
          equipos_maquinaria: this.extractEquipment(contentResult.metadata?.detailed_items || []),
          proveedores_chile: [],
          analisis_riesgos: this.generateRiskAnalysis(contentResult.metadata),
          recomendaciones: this.generateRecommendations(contentResult.metadata),
          cronograma_estimado: "Análisis de cronograma requiere información adicional del proyecto",
          desglose_costos: contentResult.metadata?.totals_by_section || {},
          factores_regionales: this.generateRegionalFactors(analysisConfig.projectLocation),
          extraction_metadata: extractionMetadata,
          confidence_score: contentResult.confidence || 85,
          processing_method: 'claude_vision_complete'
        };
        
      } else if (contentResult.extraction_method === 'claude_vision_paginated') {
        // PDF analizado por páginas
        console.log('📚 PDF analizado por páginas, consolidando resultados...');
        
        analysisResult = {
          resumen_ejecutivo: this.consolidatePaginatedAnalysis(contentResult),
          presupuesto_estimado: { total_clp: 0, note: 'Requiere cálculo manual' },
          materiales_detallados: this.extractItemsFromPaginated(contentResult, 'materiales'),
          mano_obra: this.extractItemsFromPaginated(contentResult, 'mano_obra'),
          equipos_maquinaria: this.extractItemsFromPaginated(contentResult, 'equipos'),
          contenido_completo: pdfContent,
          analisis_riesgos: [
            {
              factor: "Documento largo procesado por páginas",
              probability: "media",
              impact: "bajo",
              mitigation: "Revisar consolidación manual"
            }
          ],
          recomendaciones: [
            "Verificar totales calculados manualmente",
            "Revisar coherencia entre secciones",
            "Validar ítems extraídos por categoría"
          ],
          extraction_metadata: extractionMetadata,
          pages_processed: contentResult.pages_processed || 0,
          batches_processed: contentResult.batches_processed || 0,
          confidence_score: contentResult.confidence || 75,
          processing_method: 'claude_vision_paginated'
        };
        
      } else {
        // Fallback: usar el texto extraído para análisis tradicional
        console.log('🔄 Usando análisis tradicional con texto extraído...');
        
        // CHUNKING Y ANÁLISIS TRADICIONAL
        const chunks = await createIntelligentChunks(pdfContent);
        console.log(`🧩 ${chunks.length} chunks creados para análisis tradicional`);
        
        analysisResult = await generateDetailedPdfAnalysis(
          chunks, 
          config, 
          analysisConfig,
          analysisId
        );
        
        analysisResult.extraction_metadata = extractionMetadata;
        analysisResult.processing_method = 'traditional_chunking';
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

      // 🔥 RESPUESTA OPTIMIZADA
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
            processing_method: analysisResult.processing_method,
            // Información específica según método
            ...(contentResult.pages_processed && {
              pages_processed: contentResult.pages_processed,
              batches_processed: contentResult.batches_processed,
              successful_batches: contentResult.successful_batches
            }),
            ...(contentResult.items_extracted && {
              items_extracted: contentResult.items_extracted
            })
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
   * 🔥 FUNCIONES AUXILIARES PARA PROCESAMIENTO DE PDFs
   */

  // Genera resumen ejecutivo desde metadata de Claude Vision
  generateExecutiveSummary(metadata) {
    if (!metadata) {
      return "Análisis completado. Revise los detalles extraídos del documento.";
    }

    const budget = metadata.budget_summary;
    const itemsCount = metadata.detailed_items?.length || 0;
    
    let summary = `Documento analizado: ${budget?.document_type || 'presupuesto de construcción'}`;
    
    if (budget?.project_name) {
      summary += ` para el proyecto "${budget.project_name}"`;
    }
    
    if (budget?.contractor) {
      summary += ` elaborado por ${budget.contractor}`;
    }
    
    summary += `. Se identificaron ${itemsCount} ítems detallados`;
    
    if (budget?.total_budget_clp) {
      summary += ` con un presupuesto total de ${budget.total_budget_clp.toLocaleString('es-CL')} CLP`;
    }
    
    summary += ".";
    
    return summary;
  },

  extractMaterials(items) {
    return items
      .filter(item => item.categoria === 'materiales' || 
                    item.item?.toLowerCase().includes('material') ||
                    item.item?.toLowerCase().includes('cemento') ||
                    item.item?.toLowerCase().includes('acero') ||
                    item.item?.toLowerCase().includes('madera'))
      .map(item => ({
        item: item.item,
        descripcion: item.item,
        cantidad: item.cantidad || 0,
        unidad: item.unidad || 'unidad',
        precio_unitario: item.precio_unitario || 0,
        subtotal: item.subtotal || 0,
        categoria: 'materiales',
        seccion: item.seccion || 'materiales'
      }));
  },
  // Extrae mano de obra de los ítems analizados
  extractLabor(items) {
    return items
      .filter(item => item.categoria === 'mano_obra' || 
                    item.item?.toLowerCase().includes('mano de obra') ||
                    item.item?.toLowerCase().includes('albañil') ||
                    item.item?.toLowerCase().includes('maestro') ||
                    item.item?.toLowerCase().includes('oficial'))
      .map(item => ({
        especialidad: item.item,
        descripcion_trabajo: item.item,
        horas_totales: item.cantidad || 0,
        tarifa_hora: item.precio_unitario || 0,
        subtotal: item.subtotal || 0,
        nivel_especialidad: this.detectSkillLevel(item.item)
      }));
  },
  // Extrae equipos de los ítems analizados
  extractEquipment(items) {
    return items
      .filter(item => item.categoria === 'equipos' || 
                    item.item?.toLowerCase().includes('equipo') ||
                    item.item?.toLowerCase().includes('maquinaria') ||
                    item.item?.toLowerCase().includes('herramienta'))
      .map(item => ({
        tipo_equipo: item.item,
        descripcion: item.item,
        tiempo_uso: `${item.cantidad || 1} ${item.unidad || 'días'}`,
        tarifa_periodo: item.precio_unitario || 0,
        subtotal: item.subtotal || 0,
        categoria: 'equipos'
      }));
  },

  // Detecta nivel de especialidad
  detectSkillLevel(itemName) {
    const name = itemName.toLowerCase();
    if (name.includes('maestro') || name.includes('jefe')) return 'maestro';
    if (name.includes('oficial')) return 'oficial';
    if (name.includes('ayudante')) return 'ayudante';
    return 'oficial'; // default
  },

  // Genera análisis de riesgos basado en metadata
  generateRiskAnalysis(metadata) {
    const risks = [];
    
    if (metadata?.detailed_items) {
      const itemsCount = metadata.detailed_items.length;
      if (itemsCount > 100) {
        risks.push({
          factor: "Proyecto de gran escala",
          probability: "alta",
          impact: "alto",
          mitigation: "Implementar control riguroso de costos y cronograma"
        });
      }
    }
    
    if (metadata?.budget_summary?.total_budget_clp > 100000000) {
      risks.push({
        factor: "Presupuesto elevado",
        probability: "media",
        impact: "alto", 
        mitigation: "Establecer hitos de control financiero y contingencias"
      });
    }
    
    // Riesgo genérico si no hay metadata suficiente
    if (risks.length === 0) {
      risks.push({
        factor: "Variabilidad de precios de materiales",
        probability: "media",
        impact: "medio",
        mitigation: "Monitorear precios de mercado y establecer contratos fijos"
      });
    }
    
    return risks;
  },

  // Genera recomendaciones basadas en análisis
  generateRecommendations(metadata) {
    const recommendations = [
      "Verificar precios de materiales con proveedores actuales",
      "Establecer contratos marco para materiales principales",
      "Implementar sistema de control de avance y costos"
    ];
    
    if (metadata?.detailed_items?.length > 50) {
      recommendations.push("Considerar usar software de gestión de proyectos para seguimiento detallado");
    }
    
    if (metadata?.budget_summary?.total_budget_clp > 50000000) {
      recommendations.push("Establecer garantías bancarias y seguros de construcción");
    }
    
    return recommendations;
  },

  // Genera factores regionales
  generateRegionalFactors(location) {
    const defaultFactors = {
      climaticos: "Considerar condiciones climáticas locales para planificación",
      logisticos: "Evaluar costos de transporte según ubicación del proyecto",
      mano_obra: "Verificar disponibilidad de mano de obra especializada en la región",
      normativos: "Cumplir con regulaciones y permisos locales de construcción"
    };
    
    // Factores específicos por región (si se proporciona ubicación)
    if (location && location.toLowerCase().includes('valdivia')) {
      defaultFactors.climaticos = "Región lluviosa - planificar protecciones y considerar estacionalidad";
      defaultFactors.logisticos = "Distancia a Santiago incrementa costos de transporte en ~12%";
    }
    
    return defaultFactors;
  },

  // Consolida análisis paginado
  consolidatePaginatedAnalysis(contentResult) {
    const pages = contentResult.pages_processed || 0;
    const batches = contentResult.successful_batches || 0;
    const total = contentResult.batches_processed || 0;
    
    return `Documento de ${pages} páginas analizado en ${total} lotes, ` +
          `${batches} procesados exitosamente. El contenido ha sido extraído ` +
          `y consolidado para análisis. Se recomienda revisión manual para ` +
          `validar la completitud de la información extraída.`;
  },

  // Extrae ítems por categoría del análisis paginado
  extractItemsFromPaginated(contentResult, category) {
    const items = [];
    
    if (contentResult.detailed_results) {
      for (const result of contentResult.detailed_results) {
        if (result.budget_items) {
          const categoryItems = result.budget_items.filter(item => {
            const itemName = item.item?.toLowerCase() || '';
            switch (category) {
              case 'materiales':
                return itemName.includes('material') || itemName.includes('cemento') || 
                      itemName.includes('acero') || itemName.includes('madera');
              case 'mano_obra':
                return itemName.includes('mano') || itemName.includes('albañil') || 
                      itemName.includes('oficial') || itemName.includes('maestro');
              case 'equipos':
                return itemName.includes('equipo') || itemName.includes('maquinaria') || 
                      itemName.includes('herramienta');
              default:
                return false;
            }
          });
          
          items.push(...categoryItems);
        }
      }
    }
    
    return items.map(item => ({
      ...item,
      fuente: `Página ${item.pagina || 'N/A'}`,
      categoria: category
    }));
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

// 🔥 EXPORT CORRECTO: Default export
export default budgetController;