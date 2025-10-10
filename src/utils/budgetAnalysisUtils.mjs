// src/utils/budgetAnalysisUtils.mjs
import { pool } from '../config/database.mjs';
/**
 * Obtiene historial de análisis del usuario (todos los tipos)
 * ✅ SE USA en budgetSuggestionsRoutes.mjs
 */
export async function getUserAnalysisHistory(userId, options = {}) {
  try {
    const { 
      limit = 20, 
      offset = 0, 
      analysisType = null,
      organizationId = null 
    } = options;
    
    console.log('🔍 Obteniendo historial desde MySQL:', {
      userId,
      limit,
      offset,
      analysisType,
      organizationId
    });
    
    let query = `
      SELECT 
        id,
        analysis_id,
        analysis_type,
        file_name,
        project_type,
        location,
        area_m2,
        estimated_budget,
        confidence_score,
        summary,
        created_at
      FROM budget_analyses
      WHERE user_id = ? AND active = 1
    `;
    
    const params = [userId];
    
    // Filtrar por organización si existe
    if (organizationId) {
      query += ` AND organization_id = ?`;
      params.push(organizationId);
    }
    
    // Filtrar por tipo de análisis
    if (analysisType) {
      query += ` AND analysis_type = ?`;
      params.push(analysisType);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const [analyses] = await pool.query(query, params);
    
    // Obtener total
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM budget_analyses 
      WHERE user_id = ? AND active = 1
    `;
    const countParams = [userId];
    
    if (organizationId) {
      countQuery += ` AND organization_id = ?`;
      countParams.push(organizationId);
    }
    
    if (analysisType) {
      countQuery += ` AND analysis_type = ?`;
      countParams.push(analysisType);
    }
    
    const [[{ total }]] = await pool.query(countQuery, countParams);
    
    console.log(`✅ Historial obtenido: ${analyses.length} de ${total} análisis`);
    
    return {
      analyses,
      total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (offset + limit) < total
      }
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    throw error;
  }
}

/**
 * Guarda análisis rápido en base de datos
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function saveQuickAnalysisToDatabase(analysis, userId, projectData, clerkUserId = null, organizationId = null) {
  try {
    const analysisId = `quick_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const analysisRecord = {
      analysis_id: analysisId,
      organization_id: organizationId,
      user_id: userId,
      clerk_user_id: clerkUserId,
      analysis_type: 'quick',
      
      // Datos del proyecto
      project_type: projectData.type || 'Proyecto General',
      location: projectData.location || 'Chile',
      area_m2: projectData.area || null,
      
      // Resultados
      estimated_budget: analysis.presupuesto_estimado?.total_clp || 0,
      confidence_score: analysis.metadata?.confidence_score || 70,
      
      // Resumen
      summary: `Análisis rápido para ${projectData.type || 'proyecto'} en ${projectData.location || 'Chile'}`,
      
      // JSON completos
      full_analysis: JSON.stringify(analysis),
      project_data: JSON.stringify(projectData),
      metadata: JSON.stringify({
        analysis_depth: 'quick',
        area_m2: projectData.area,
        initial_budget_estimate: projectData.estimatedBudget,
        ...analysis.metadata
      }),
      
      active: true
    };
    
    console.log('💾 Guardando análisis rápido en MySQL:', {
      id: analysisId,
      user_id: userId,
      type: analysisRecord.project_type,
      budget: analysisRecord.estimated_budget
    });
    
    const [result] = await pool.query(
      'INSERT INTO budget_analyses SET ?',
      analysisRecord
    );
    
    console.log('✅ Análisis rápido guardado en MySQL, ID:', result.insertId);
    
    return {
      id: result.insertId,
      analysis_id: analysisId,
      saved: true
    };
    
  } catch (error) {
    console.error('❌ Error guardando análisis rápido:', error);
    throw error;
  }
}

/**
 * Extrae datos del proyecto desde la base de datos (por ID)
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function extractProjectData(projectId) {
  // TODO: Implementar consulta real a base de datos
  // Por ahora, placeholder con datos completos para desarrollo
  console.log(`🔍 [PLACEHOLDER] Extrayendo datos del proyecto: ${projectId}`);
  
  return {
    id: projectId,
    name: `Proyecto ${projectId}`,
    type: 'residential',
    location: 'Santiago, Chile',
    area: 120,
    estimatedBudget: 50000000,
    description: 'Proyecto de ejemplo para desarrollo',
    startDate: '2024-01-15',
    client: 'Cliente Example',
    address: 'Dirección ejemplo 123',
    floors: 2,
    bedrooms: 3,
    bathrooms: 2
  };
}

/**
 * Valida que los datos del proyecto sean suficientes para análisis
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export function validateProjectData(projectData) {
  const errors = [];
  
  // Campos obligatorios
  if (!projectData.type || projectData.type.trim() === '') {
    errors.push('Tipo de proyecto requerido');
  }
  
  if (!projectData.location || projectData.location.trim() === '') {
    errors.push('Ubicación del proyecto requerida');
  }
  
  if (!projectData.area || projectData.area <= 0) {
    errors.push('Área construida requerida y debe ser mayor a 0');
  }
  
  return errors;
}

/**
 * Procesa y valida configuración de análisis PDF
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export function processAnalysisConfig(reqBody) {
  return {
    depth: reqBody.analysisDepth || 'standard',
    includeProviders: reqBody.includeProviders !== false,
    projectType: reqBody.projectType || 'unknown',
    projectLocation: reqBody.projectLocation || 'Chile',
    maxCostEstimate: reqBody.maxCostEstimate || null
  };
}

/**
 * Valida archivo PDF subido
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export function validatePdfFile(file) {
  const errors = [];
  
  if (!file) {
    errors.push('No se recibió archivo PDF');
    return errors;
  }
  
  if (file.mimetype !== 'application/pdf') {
    errors.push('Solo se permiten archivos PDF');
  }
  
  if (file.size > 15 * 1024 * 1024) {
    errors.push('Archivo demasiado grande. Máximo 15MB permitido');
  }
  
  return errors;
}

/**
 * Crea metadata de extracción de PDF
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export function createExtractionMetadata(contentResult) {
  return {
    extraction_method: contentResult.extraction_method,
    confidence: contentResult.confidence,
    source: contentResult.source,
    images_processed: contentResult.images_processed || 0,
    pdf_type: contentResult.pdf_type,
    processing_time_ms: contentResult.processing_time_ms,
    warning: contentResult.warning
  };
}

/**
 * Maneja errores de análisis PDF con códigos específicos
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export function handlePdfAnalysisError(error) {
  console.error('❌ Error en análisis PDF:', error);
  
  if (error.message.includes('API key')) {
    return {
      status: 503,
      error_code: 'AI_SERVICE_UNAVAILABLE',
      message: 'Servicio de análisis IA temporalmente no disponible'
    };
  }
  
  if (error.message.includes('rate limit')) {
    return {
      status: 429,
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Límite de análisis alcanzado. Intente nuevamente en unos minutos',
      retry_after: 300
    };
  }
  
  if (error.message.includes('pdf2pic')) {
    return {
      status: 400,
      error_code: 'PDF_CONVERSION_ERROR',
      message: 'Error convirtiendo PDF. Verifique que el archivo no esté corrupto'
    };
  }
  
  return {
    status: 400,
    error_code: 'PDF_PROCESSING_ERROR',
    message: error.message
  };
}

// ====================================================================
// 💾 FUNCIONES DE BASE DE DATOS (PLACEHOLDERS - TODAS SE USAN)
// ====================================================================

/**
 * Guarda análisis de proyecto en base de datos
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function saveAnalysisToDatabase(projectId, analysis, userId, clerkUserId = null, organizationId = null) {
  try {
    const analysisId = `project_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const analysisRecord = {
      analysis_id: analysisId,
      organization_id: organizationId,
      user_id: userId,
      clerk_user_id: clerkUserId,
      analysis_type: 'project',
      project_id: projectId,
      
      // Datos principales
      project_type: analysis.project_type || 'general',
      location: analysis.location || 'Chile',
      area_m2: analysis.area || null,
      
      // Resultados
      estimated_budget: analysis.presupuesto_estimado?.total_clp || 0,
      confidence_score: analysis.metadata?.confidence_score || 75,
      
      // Resumen
      summary: analysis.resumen_ejecutivo?.substring(0, 500) || 'Análisis de proyecto',
      
      // JSON completos
      full_analysis: JSON.stringify(analysis),
      project_data: null,
      metadata: JSON.stringify({
        analysis_depth: 'standard',
        include_market_rates: true,
        api_cost: analysis.metadata?.api_cost_estimate?.estimated_cost_usd || 0,
        ...analysis.metadata
      }),
      
      active: true
    };
    
    console.log('💾 Guardando análisis de proyecto en MySQL:', {
      id: analysisId,
      user_id: userId,
      project_id: projectId,
      budget: analysisRecord.estimated_budget
    });
    
    const [result] = await pool.query(
      'INSERT INTO budget_analyses SET ?',
      analysisRecord
    );
    
    console.log('✅ Análisis de proyecto guardado en MySQL, ID:', result.insertId);
    
    return {
      id: result.insertId,
      analysis_id: analysisId,
      saved: true
    };
    
  } catch (error) {
    console.error('❌ Error guardando análisis de proyecto:', error);
    throw error;
  }
}

/**
 * Guarda análisis PDF en base de datos
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function savePdfAnalysisToDatabase(analysisId, analysis, userId, fileName = null, clerkUserId = null, organizationId = null) {
  try {
    const analysisRecord = {
      analysis_id: analysisId,
      organization_id: organizationId,
      user_id: userId,
      clerk_user_id: clerkUserId,
      analysis_type: 'pdf',
      
      // Información del archivo
      file_name: fileName,
      file_size: analysis.metadata?.file_size || null,
      
      // Datos principales
      project_type: analysis.project_type || 'Análisis de Presupuesto',
      location: analysis.location || 'Chile',
      area_m2: analysis.area || null,
      
      // Resultados
      estimated_budget: analysis.presupuesto_estimado?.total_clp || 
                       analysis.presupuesto_ajustado?.total_clp || 0,
      confidence_score: analysis.metadata?.confidence_score || 80,
      
      // Resumen
      summary: analysis.resumen_ejecutivo?.substring(0, 500) || 
               'Análisis de presupuesto desde PDF',
      
      // JSON completos
      full_analysis: JSON.stringify(analysis),
      project_data: null,
      metadata: JSON.stringify({
        pages_analyzed: analysis.metadata?.pages_analyzed || 0,
        text_length: analysis.metadata?.text_length || 0,
        api_cost: analysis.metadata?.api_cost_estimate?.estimated_cost_usd || 0,
        processing_time_ms: analysis.metadata?.processing_time_ms || 0,
        ...analysis.metadata
      }),
      
      active: true
    };
    
    console.log('💾 Guardando análisis PDF en MySQL:', {
      id: analysisId,
      user_id: userId,
      file_name: fileName,
      budget: analysisRecord.estimated_budget
    });
    
    const [result] = await pool.query(
      'INSERT INTO budget_analyses SET ?',
      analysisRecord
    );
    
    console.log('✅ Análisis PDF guardado en MySQL, ID:', result.insertId);
    
    return {
      id: result.insertId,
      analysis_id: analysisId,
      saved: true
    };
    
  } catch (error) {
    console.error('❌ Error guardando análisis PDF:', error);
    throw error;
  }
}


/**
 * Obtiene análisis PDF desde base de datos por ID
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function getPdfAnalysisFromDatabase(analysisId) {
  try {
    console.log('🔍 Buscando análisis por ID:', analysisId);
    
    const [rows] = await pool.query(
      `SELECT * FROM budget_analyses WHERE analysis_id = ? AND active = 1 LIMIT 1`,
      [analysisId]
    );
    
    if (rows.length === 0) {
      console.log('⚠️ Análisis no encontrado');
      return null;
    }
    
    const analysis = rows[0];
    
    // Parsear JSON
    if (analysis.full_analysis) {
      analysis.full_analysis = JSON.parse(analysis.full_analysis);
    }
    if (analysis.project_data) {
      analysis.project_data = JSON.parse(analysis.project_data);
    }
    if (analysis.metadata) {
      analysis.metadata = JSON.parse(analysis.metadata);
    }
    
    console.log('✅ Análisis encontrado:', analysis.analysis_id);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Error obteniendo análisis:', error);
    throw error;
  }
}

/**
 * Incrementa contador de uso del usuario
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function incrementUserUsage(userId, actionType) {
  // TODO: Implementar tracking real de uso para analytics
  console.log('📊 [PLACEHOLDER] Incrementando uso:', { 
    user_id: userId, 
    action: actionType,
    timestamp: new Date().toISOString()
  });
  
  return {
    user_id: userId,
    action: actionType,
    count: 1,
    updated: true
  };
}

/**
 * Obtiene historial de análisis de un proyecto
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function getProjectAnalysisHistory(projectId, options = {}) {
  // TODO: Implementar query real a base de datos
  const { limit = 10, offset = 0 } = options;
  
  console.log('🔍 [PLACEHOLDER] Obteniendo historial:', { 
    projectId, 
    limit, 
    offset 
  });
  
  // Simulación de respuesta para desarrollo
  return {
    analyses: [
      {
        id: 'analysis_001',
        created_at: '2024-01-15T10:30:00Z',
        confidence_score: 85,
        estimated_budget: 75000000,
        analysis_type: 'standard',
        summary: 'Análisis inicial con factores regionales'
      },
      {
        id: 'analysis_002', 
        created_at: '2024-01-20T14:15:00Z',
        confidence_score: 92,
        estimated_budget: 78500000,
        analysis_type: 'detailed',
        summary: 'Análisis actualizado con datos de mercado'
      }
    ],
    total: 2,
    project_id: projectId,
    pagination: {
      limit,
      offset,
      has_more: false
    }
  };
}

/**
 * Compara múltiples análisis de un proyecto específico
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function compareProjectAnalyses(projectId, analysisIds, comparisonType = 'total_cost') {
  // TODO: Implementar lógica real de comparación
  console.log('🔄 [PLACEHOLDER] Comparando análisis de proyecto:', { 
    projectId, 
    analysisIds, 
    comparisonType 
  });
  
  // Simulación de respuesta
  return {
    project_id: projectId,
    comparison_type: comparisonType,
    analyses_compared: analysisIds.length,
    budget_comparison: {
      min_budget: 75000000,
      max_budget: 78500000,
      average_budget: 76750000,
      variance_percentage: 4.7
    },
    confidence_comparison: {
      min_confidence: 85,
      max_confidence: 92,
      average_confidence: 88.5
    },
    key_differences: [
      'Análisis más reciente incluye factor inflacionario actualizado',
      'Variación en costos de mano de obra por estacionalidad',
      'Diferencias en estimación de materiales importados'
    ],
    recommendations: [
      'Usar análisis más reciente para decisiones finales',
      'Considerar promedio para estimación conservadora',
      'Revisar factores que causan mayor variación'
    ],
    timestamp: new Date().toISOString()
  };
}

/**
 * Genera comparación de múltiples análisis PDF
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function generatePdfComparison(analysisIds, comparisonType = 'total_cost') {
  // TODO: Implementar lógica real de comparación
  console.log('🔄 [PLACEHOLDER] Comparando análisis PDF:', { 
    analysisIds, 
    comparisonType 
  });
  
  // Simulación de respuesta
  return {
    comparison_type: comparisonType,
    analyses_count: analysisIds.length,
    comparison_summary: {
      total_documents: analysisIds.length,
      avg_confidence: 87,
      budget_range: {
        min: 45000000,
        max: 89000000,
        average: 67000000
      }
    },
    detailed_comparison: analysisIds.map((id, index) => ({
      analysis_id: id,
      order: index + 1,
      estimated_budget: 45000000 + (index * 22000000),
      confidence: 85 + (index * 2),
      document_type: 'construction_budget'
    })),
    insights: [
      'Variación significativa entre documentos sugiere diferentes alcances',
      'Confianza promedio alta indica buena calidad de extracción',
      'Se recomienda revisar documentos con mayor desviación'
    ],
    timestamp: new Date().toISOString()
  };
}

// ====================================================================
// 🧩 FUNCIONES DE PROCESAMIENTO DE PDFs (SOLO LA QUE SE USA)
// ====================================================================

/**
 * Crea chunks inteligentes basados en secciones del presupuesto
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function createIntelligentChunks(text) {
  const chunks = [];
  const maxChunkSize = 15000; // Caracteres por chunk
  const overlap = 200; // Solapamiento entre chunks
  
  // Detectar secciones principales
  const sections = detectBudgetSections(text);
  
  if (sections.length > 0) {
    // Chunking basado en secciones
    for (const section of sections) {
      if (section.content.length <= maxChunkSize) {
        chunks.push({
          type: section.type,
          content: section.content,
          metadata: { section: section.title }
        });
      } else {
        // Dividir secciones grandes
        const subChunks = createTextChunks(section.content, maxChunkSize, overlap);
        subChunks.forEach((chunk, index) => {
          chunks.push({
            type: section.type,
            content: chunk,
            metadata: { 
              section: section.title,
              subChunk: index + 1,
              totalSubChunks: subChunks.length
            }
          });
        });
      }
    }
  } else {
    // Chunking simple si no se detectan secciones
    const textChunks = createTextChunks(text, maxChunkSize, overlap);
    textChunks.forEach((chunk, index) => {
      chunks.push({
        type: 'general',
        content: chunk,
        metadata: { chunk: index + 1, totalChunks: textChunks.length }
      });
    });
  }
  
  return chunks;
}

// ====================================================================
// 🔧 FUNCIONES AUXILIARES INTERNAS (USADAS POR createIntelligentChunks)
// ====================================================================

/**
 * Detecta secciones del presupuesto en el texto
 * ✅ USADA INTERNAMENTE por createIntelligentChunks
 */
function detectBudgetSections(text) {
  const sections = [];
  const lines = text.split('\n');
  
  const sectionPatterns = [
    { pattern: /materiales|insumos|suministros/i, type: 'materials' },
    { pattern: /mano\s+de\s+obra|personal|trabajadores/i, type: 'labor' },
    { pattern: /equipos|maquinaria|herramientas/i, type: 'equipment' },
    { pattern: /subcontratos|servicios\s+externos/i, type: 'subcontracts' },
    { pattern: /gastos\s+generales|administrativos/i, type: 'overhead' },
    { pattern: /resumen|total|presupuesto\s+total/i, type: 'summary' }
  ];

  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Buscar inicio de nueva sección
    const sectionMatch = sectionPatterns.find(p => p.pattern.test(line));
    
    if (sectionMatch) {
      // Guardar sección anterior si existe
      if (currentSection && currentContent.length > 0) {
        sections.push({
          type: currentSection.type,
          title: currentSection.title,
          content: currentContent.join('\n')
        });
      }
      
      // Iniciar nueva sección
      currentSection = {
        type: sectionMatch.type,
        title: line
      };
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  
  // Agregar última sección
  if (currentSection && currentContent.length > 0) {
    sections.push({
      type: currentSection.type,
      title: currentSection.title,
      content: currentContent.join('\n')
    });
  }
  
  return sections;
}

/**
 * Divide texto en chunks con solapamiento
 * ✅ USADA INTERNAMENTE por createIntelligentChunks
 */
function createTextChunks(text, maxSize, overlap) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxSize;
    
    // Ajustar al final de una línea si es posible
    if (end < text.length) {
      const nextNewline = text.indexOf('\n', end);
      if (nextNewline !== -1 && nextNewline - end < 200) {
        end = nextNewline;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end - overlap;
  }
  
  return chunks;
}