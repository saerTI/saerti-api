// src/utils/budgetAnalysisUtils.mjs
// 🔥 VERSIÓN LIMPIA - SOLO FUNCIONES UTILIZADAS

// ====================================================================
// 🔧 FUNCIONES DE EXTRACCIÓN Y VALIDACIÓN (TODAS SE USAN)
// ====================================================================

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
export async function saveAnalysisToDatabase(projectId, analysis, userId) {
  // TODO: Implementar guardado real en base de datos
  console.log('💾 [PLACEHOLDER] Guardando análisis en BD:', {
    project_id: projectId,
    user_id: userId,
    analysis_size: JSON.stringify(analysis).length
  });
  
  return {
    id: `analysis_${Date.now()}`,
    saved: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Guarda análisis PDF en base de datos
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function savePdfAnalysisToDatabase(analysisId, analysis, userId) {
  // TODO: Implementar guardado real en BD
  console.log('💾 [PLACEHOLDER] Guardando análisis PDF:', { 
    analysisId, 
    userId,
    analysis_size: JSON.stringify(analysis).length 
  });
  
  return {
    id: analysisId,
    saved: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Obtiene análisis PDF desde base de datos por ID
 * ✅ SE USA en budgetSuggestionsController.mjs
 */
export async function getPdfAnalysisFromDatabase(analysisId) {
  // TODO: Implementar consulta real a BD
  console.log('🔍 [PLACEHOLDER] Buscando análisis PDF:', { analysisId });
  
  // Simular que no se encuentra para desarrollo
  return null;
  
  // Cuando implementes la BD real, retorna algo como:
  // return {
  //   id: analysisId,
  //   analysis: { ... },
  //   created_at: '2024-01-15T10:30:00Z',
  //   user_id: 'user123'
  // };
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