// src/utils/budgetAnalysisUtils.mjs

/**
 * Extrae y normaliza datos del proyecto desde el request
 */
export function extractProjectData(req) {
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
export function validateProjectData(projectData) {
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
export function calculateValidationConfidence(projectData) {
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
export async function saveAnalysisToDatabase(projectId, analysis, userId) {
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
 * Guarda análisis PDF en base de datos (placeholder)
 */
export async function savePdfAnalysisToDatabase(analysisId, analysis, userId) {
  // TODO: Implementar guardado en BD
  console.log('💾 [PLACEHOLDER] Guardando análisis PDF:', { analysisId, userId });
  return true;
}

/**
 * Obtiene análisis PDF desde base de datos (placeholder)
 */
export async function getPdfAnalysisFromDatabase(analysisId, userId) {
  // TODO: Implementar consulta a BD
  console.log('🔍 [PLACEHOLDER] Buscando análisis PDF:', { analysisId, userId });
  return null;
}

/**
 * Incrementa contador de uso del usuario
 */
export async function incrementUserUsage(userId, actionType) {
  // TODO: Implementar tracking de uso por usuario
  // Para rate limiting y analytics
  
  console.log('📊 [PLACEHOLDER] Incrementando uso:', { user_id: userId, action: actionType });
  return true;
}

/**
 * Obtiene historial de análisis de un proyecto
 */
export async function getProjectAnalysisHistory(projectId, limit, offset) {
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
export async function compareProjectAnalyses(projectId, analysisIds) {
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

/**
 * Genera comparación de análisis PDF
 */
export async function generatePdfComparison(analyses, comparisonType) {
  // TODO: Implementar lógica de comparación
  return {
    comparison_type: comparisonType,
    analyses_count: analyses.length,
    summary: 'Comparación placeholder'
  };
}

// **FUNCIONES ESPECÍFICAS PARA ANÁLISIS PDF**

/**
 * Crea chunks inteligentes basados en secciones del presupuesto
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

/**
 * Detecta secciones del presupuesto en el texto
 */
export function detectBudgetSections(text) {
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
 */
export function createTextChunks(text, maxSize, overlap) {
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

/**
 * Calcula score de confianza para análisis PDF
 */
export function calculatePdfConfidenceScore(results, consolidatedData) {
  let score = 50; // Base score
  
  // Agregar puntos por chunks procesados exitosamente
  const successfulChunks = results.filter(r => !r.error).length;
  const totalChunks = results.length;
  score += (successfulChunks / totalChunks) * 30;
  
  // Agregar puntos por datos extraídos
  if (consolidatedData.materials.length > 0) score += 10;
  if (consolidatedData.labor.length > 0) score += 10;
  if (consolidatedData.equipment.length > 0) score += 5;
  if (consolidatedData.providers.length > 0) score += 5;
  
  return Math.min(Math.round(score), 100);
}