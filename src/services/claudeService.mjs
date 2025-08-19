// src/services/claudeService.mjs
// 🔥 VERSIÓN LIMPIA - SOLO FUNCIONES UTILIZADAS
import config from '../config/config.mjs';
import Anthropic from '@anthropic-ai/sdk';

import { 
  preValidatePdfContent,
  smartChunkExtractor,
  generateOptimizedPrompt,
  robustJsonParser,
  intelligentConsolidator,
  generateOptimizedFinalAnalysis,
  estimateApiCosts
} from './pdfAnalysisOptimizer.mjs';

// Verificar que la API key esté configurada
if (!config.anthropic.apiKey) {
  console.error('❌ ANTHROPIC_API_KEY no está configurada en las variables de entorno');
  throw new Error('Anthropic API key is required');
}

// Inicializar cliente de Anthropic usando tu config
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

console.log('✅ Cliente de Anthropic inicializado correctamente');

/**
 * 🔥 FUNCIÓN PRINCIPAL 1: Genera sugerencias presupuestarias usando Claude
 * @param {Object} projectData - Datos del proyecto
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Análisis presupuestario estructurado
 */
export const generateBudgetSuggestions = async (projectData, options = {}) => {
  try {
    console.log(`🤖 Iniciando análisis con ${config.anthropic.model} para:`, projectData.description || projectData.type);
    
    // 🔥 VALIDACIÓN PREVIA
    if (!projectData || !projectData.type) {
      throw new Error('Datos de proyecto inválidos - tipo requerido');
    }
    
    const contextPrompt = buildProjectContext(projectData, options);
    
    // 🔥 LLAMADA A API CON MANEJO DE ERRORES ROBUSTO
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: contextPrompt
      }]
    });

    if (!response || !response.content || !response.content[0]) {
      throw new Error('Respuesta inválida de la API de Anthropic');
    }

    const analysisText = response.content[0].text;
    console.log(`✅ ${config.anthropic.model} completó análisis manual`);
    
    // 🔥 PARSEO MEJORADO CON FALLBACKS
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON parseado exitosamente');
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Respuesta no es JSON válido, creando estructura...');
      analysis = parseTextToStructured(analysisText);
    }

    // 🔥 METADATA MEJORADA
    analysis.metadata = {
      generated_at: new Date().toISOString(),
      model_used: config.anthropic.model,
      project_id: projectData.id || null,
      confidence_score: calculateConfidenceScore(projectData),
      api_cost_estimate: estimateApiCost(response.usage || {}),
      processing_time_ms: Date.now() - Date.now(),
      success: true
    };

    console.log('✅ Análisis completado exitosamente');
    return analysis;

  } catch (error) {
    console.error('❌ Error en generateBudgetSuggestions:', error);
    
    // 🔥 MANEJO ESPECÍFICO DE ERRORES DE ANTHROPIC
    if (error.status === 404) {
      throw new Error(`Modelo no válido: ${config.anthropic.model}. Verifique la configuración.`);
    }
    
    if (error.status === 401) {
      throw new Error('API Key de Anthropic inválida o sin permisos');
    }
    
    if (error.status === 429) {
      throw new Error('Límite de rate limit alcanzado en Anthropic API');
    }
    
    if (error.status === 400) {
      throw new Error(`Error en la solicitud a Anthropic: ${error.message}`);
    }
    
    // Error genérico
    throw new Error(`Error en análisis presupuestario: ${error.message}`);
  }
};

/**
 * 🔥 PROMPT OPTIMIZADO para mejor extracción
 */
const OPTIMIZED_PDF_SYSTEM_PROMPT = `Eres un experto analizador de presupuestos de construcción chileno.

OBJETIVO: Extraer información presupuestaria estructurada de forma precisa y eficiente.

REGLAS CRÍTICAS:
1. RESPONDER ÚNICAMENTE JSON VÁLIDO - Sin texto adicional
2. Usar formato numérico sin puntos/comas en números
3. Si no hay datos claros, usar arrays vacíos []
4. Ser conservador - mejor pocos datos correctos que muchos incorrectos
5. Enfocar en valores monetarios reales y cantidades específicas

CONTEXTO CHILENO:
- Precios en CLP (pesos chilenos)
- Unidades métricas (m², m³, kg, ton)
- Proveedores y marcas locales
- Normativas NCh y OGUC

FORMATO OBLIGATORIO DE RESPUESTA:
{
  "materiales_encontrados": [...],
  "mano_obra_encontrada": [...],
  "equipos_encontrados": [...],
  "proveedores_mencionados": [...],
  "valores_totales": {"subtotal_chunk": 0, "moneda": "CLP"},
  "observaciones": "breve_nota_si_necesario"
}`;

/**
 * 🔥 FUNCIÓN PRINCIPAL 2: Genera análisis detallado de PDF usando múltiples consultas a Claude
 * @param {Array} chunks - Chunks de texto del PDF
 * @param {Object} config - Configuración del análisis
 * @param {Object} analysisConfig - Configuración específica del análisis
 * @param {string} analysisId - ID único del análisis
 * @returns {Promise<Object>} - Análisis consolidado
 */
export const generateDetailedPdfAnalysis = async (extractedText, config = {}) => {
  const analysisId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log('🚀 Iniciando análisis PDF optimizado');
    
    // 🔥 PASO 1: Pre-validación para evitar análisis inútiles
    const validation = await preValidatePdfContent(extractedText);
    
    if (!validation.isAnalyzable) {
      console.log('⚠️ PDF no analizable, retornando análisis básico');
      return generateEmptyAnalysisResponse(analysisId, validation.recommendation);
    }

    if (validation.confidence < 40) {
      console.log('⚠️ Confianza baja en el PDF, procesamiento limitado');
      return generateLowConfidenceAnalysis(analysisId, extractedText, validation);
    }

    console.log(`✅ PDF validado - Confianza: ${validation.confidence}%`);

    // 🔥 PASO 2: Chunking inteligente (solo chunks útiles)
    const relevantChunks = smartChunkExtractor(extractedText, 3500);
    
    if (relevantChunks.length === 0) {
      console.log('⚠️ No se encontraron chunks con contenido presupuestario');
      return generateEmptyAnalysisResponse(analysisId, 'No se encontró contenido presupuestario estructurado');
    }

    // Limitar chunks para evitar consumo excesivo
    const maxChunks = Math.min(relevantChunks.length, 8); // 👈 LÍMITE CRÍTICO
    const chunksToProcess = relevantChunks.slice(0, maxChunks);
    
    console.log(`📝 Procesando ${chunksToProcess.length} chunks de ${relevantChunks.length} disponibles`);

    // 🔥 PASO 3: Análisis paralelo limitado de chunks
    const chunkPromises = chunksToProcess.map(async (chunk, index) => {
      try {
        console.log(`🔍 Analizando chunk ${index + 1}/${chunksToProcess.length}`);
        
        const prompt = generateOptimizedPrompt(chunk, index + 1, chunksToProcess.length);
        
        const response = await anthropic.messages.create({
          model: config.anthropic?.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 2000, // 👈 REDUCIDO para evitar tokens excesivos
          temperature: 0.1, // 👈 MÁS DETERMINISTA
          system: OPTIMIZED_PDF_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        });

        const parseResult = robustJsonParser(response.content[0].text, index + 1);
        
        return {
          chunkIndex: index,
          success: parseResult.success,
          data: parseResult.data,
          error: parseResult.error,
          tokensUsed: response.usage?.total_tokens || 0
        };

      } catch (error) {
        console.error(`❌ Error en chunk ${index + 1}:`, error.message);
        return {
          chunkIndex: index,
          success: false,
          data: null,
          error: error.message
        };
      }
    });

    // Ejecutar análisis con timeout de seguridad
    const results = await Promise.allSettled(chunkPromises);
    const chunkResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    const totalTokensUsed = chunkResults.reduce((sum, result) => sum + (result.tokensUsed || 0), 0);
    console.log(`💰 Tokens consumidos: ${totalTokensUsed}`);

    // 🔥 PASO 4: Consolidación inteligente
    const consolidatedData = intelligentConsolidator(chunkResults);

    // 🔥 PASO 5: Análisis final solo si hay datos útiles
    const finalAnalysis = generateOptimizedFinalAnalysis(consolidatedData, config);

    // Agregar metadatos de optimización
    finalAnalysis.optimization_metadata = {
      original_chunks_available: relevantChunks.length,
      chunks_processed: chunksToProcess.length,
      chunks_successful: consolidatedData.successful_chunks,
      validation_confidence: validation.confidence,
      total_tokens_used: totalTokensUsed,
      cost_optimization: {
        chunks_skipped: relevantChunks.length - chunksToProcess.length,
        estimated_tokens_saved: (relevantChunks.length - chunksToProcess.length) * 2000
      }
    };

    console.log('✅ Análisis PDF optimizado completado exitosamente');
    return finalAnalysis;

  } catch (error) {
    console.error('❌ Error en generateDetailedPdfAnalysis optimizado:', error);
    
    return generateErrorAnalysisResponse(analysisId, error.message);
  }
};

/**
 * 🔥 FUNCIÓN AUXILIAR: Validación de archivo PDF antes de procesamiento
 */
export const validatePdfBeforeProcessing = (fileBuffer, fileName) => {
  const errors = [];
  const warnings = [];

  // Validar tamaño (máximo 20MB para evitar costos excesivos)
  if (fileBuffer.length > 20 * 1024 * 1024) {
    errors.push('Archivo demasiado grande. Máximo 20MB permitido para análisis optimizado.');
  }

  // Validar que sea PDF
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    errors.push('Solo se permiten archivos PDF.');
  }

  // Verificar header PDF
  const pdfHeader = fileBuffer.slice(0, 8).toString();
  if (!pdfHeader.startsWith('%PDF-')) {
    errors.push('Archivo no es un PDF válido.');
  }

  // Advertencias
  if (fileBuffer.length > 10 * 1024 * 1024) {
    warnings.push('Archivo grande - el análisis puede tomar más tiempo y consumir más créditos.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileSize: fileBuffer.length,
    fileSizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2)
  };
};

/**
 * 🔥 FUNCIÓN PRINCIPAL MEJORADA: Wrapper con todas las optimizaciones
 */
export const analyzePdfWithOptimizations = async (fileBuffer, fileName, config = {}) => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Iniciando análisis PDF con optimizaciones completas');

    // 1. Validación previa del archivo
    const fileValidation = validatePdfBeforeProcessing(fileBuffer, fileName);
    if (!fileValidation.isValid) {
      throw new Error(fileValidation.errors[0]);
    }

    // 2. Extracción de texto (simulada - usa tu método actual)
    const extractedText = await extractTextFromPdf(fileBuffer);
    
    // 3. Estimación de costos
    const costEstimate = estimateApiCosts(extractedText.length, config);
    console.log('💰 Estimación de costos:', costEstimate);

    // Advertencia si el costo es muy alto
    if (costEstimate.estimated_cost_usd > 1.5) {
      console.log('⚠️ ADVERTENCIA: Análisis costoso - considerando optimizaciones adicionales');
      config.forceBasicAnalysis = true;
    }

    // 4. Análisis optimizado
    const analysisResult = await generateDetailedPdfAnalysis(extractedText, config);

    // 5. Agregar métricas finales
    analysisResult.final_metrics = {
      processing_time_seconds: (Date.now() - startTime) / 1000,
      file_size_mb: fileValidation.fileSizeMB,
      estimated_api_cost: costEstimate,
      optimization_applied: true
    };

    console.log('✅ Análisis PDF optimizado completado en', analysisResult.final_metrics.processing_time_seconds, 'segundos');
    
    return analysisResult;

  } catch (error) {
    console.error('❌ Error en análisis PDF optimizado:', error);
    throw error;
  }
};

// Función simulada - reemplaza con tu extractor actual
const extractTextFromPdf = async (fileBuffer) => {
  // Aquí va tu lógica actual de extracción de texto del PDF
  // Por ahora retorno un ejemplo
  return "Texto extraído del PDF...";
};


// ====================================================================
// 🔧 FUNCIONES AUXILIARES INTERNAS (SOLO LAS QUE SE USAN)
// ====================================================================


/**
 * Genera respuesta de error estructurada
 */
const generateErrorAnalysisResponse = (analysisId, errorMessage) => {
  return {
    resumen_ejecutivo: 'Error durante el análisis del presupuesto. Por favor, intente nuevamente con un archivo diferente.',
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
      factor: 'Error en procesamiento',
      probability: 'alta',
      impact: 'alto',
      mitigation: 'Verificar formato del archivo y reintentar'
    }],
    recomendaciones: [
      'Verificar que el archivo PDF no esté corrupto',
      'Asegurar que el archivo contiene texto seleccionable',
      'Intentar con un archivo de menor tamaño',
      'Contactar soporte técnico si el problema persiste'
    ],
    cronograma_estimado: 'No disponible debido a error',
    confidence_score: 0,
    chunks_procesados: 0,
    chunks_exitosos: 0,
    processing_method: 'error_fallback',
    metadata: {
      analysis_id: analysisId,
      model_used: 'error_handler',
      processing_time: new Date().toISOString(),
      success: false,
      error: errorMessage
    }
  };
};

/**
 * Genera análisis básico para PDFs con confianza baja
 */
const generateLowConfidenceAnalysis = async (analysisId, text, validation) => {
  try {
    // Análisis muy básico con 1 sola llamada a la API
    const basicPrompt = `Analiza este texto de presupuesto chileno y extrae solo la información MÁS EVIDENTE:

${text.substring(0, 2000)}

Responde SOLO con JSON:
{
  "elementos_encontrados": ["lista", "de", "elementos", "evidentes"],
  "posibles_precios": ["valores", "monetarios", "encontrados"],
  "observacion_general": "descripcion_muy_breve"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // 👈 MODELO MÁS BARATO para análisis básico
      max_tokens: 500,
      temperature: 0,
      messages: [{ role: "user", content: basicPrompt }]
    });

    const basicResult = JSON.parse(response.content[0].text);

    return {
      resumen_ejecutivo: `Análisis básico completado. ${basicResult.observacion_general || 'Información limitada disponible'}.`,
      presupuesto_estimado: {
        total_clp: 0,
        materials_percentage: 0,
        labor_percentage: 0,
        equipment_percentage: 0,
        overhead_percentage: 0
      },
      materiales_detallados: basicResult.elementos_encontrados?.map(item => ({
        item: item,
        cantidad: 0,
        unidad: 'und',
        precio_unitario: 0,
        subtotal: 0,
        categoria: 'identificado_basico'
      })) || [],
      mano_obra: [],
      equipos_maquinaria: [],
      proveedores_chile: [],
      analisis_riesgos: [{
        factor: 'Calidad de información limitada',
        probability: 'alta',
        impact: 'medio',
        mitigation: 'Proporcionar presupuesto en formato más claro y estructurado'
      }],
      recomendaciones: [
        'Mejorar formato del presupuesto para análisis más detallado',
        'Incluir tabla con columnas claramente definidas',
        'Especificar cantidades y unidades de medida'
      ],
      cronograma_estimado: 'Requiere información más detallada',
      confidence_score: validation.confidence,
      chunks_procesados: 1,
      chunks_exitosos: 1,
      processing_method: 'basic_analysis',
      metadata: {
        analysis_id: analysisId,
        model_used: 'claude-3-haiku-20240307',
        processing_time: new Date().toISOString(),
        success: true,
        confidence_level: 'low'
      }
    };

  } catch (error) {
    console.error('Error en análisis básico:', error);
    return generateEmptyAnalysisResponse(analysisId, 'Error en análisis básico');
  }
};


/**
 * Genera respuesta para PDFs no analizables
 */
const generateEmptyAnalysisResponse = (analysisId, reason) => {
  return {
    resumen_ejecutivo: `El archivo analizado no contiene información presupuestaria suficiente para generar un análisis detallado. ${reason}`,
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
      factor: 'Información insuficiente',
      probability: 'alta',
      impact: 'alto',
      mitigation: 'Proporcionar presupuesto más detallado en formato estructurado'
    }],
    recomendaciones: [
      'Utilizar formato de presupuesto más estructurado (Excel con columnas claras)',
      'Incluir cantidades, unidades y precios unitarios específicos',
      'Agregar especificaciones técnicas de materiales'
    ],
    cronograma_estimado: 'Requiere información presupuestaria detallada',
    confidence_score: 0,
    chunks_procesados: 0,
    chunks_exitosos: 0,
    processing_method: 'validation_failed',
    metadata: {
      analysis_id: analysisId,
      model_used: 'validation_only',
      processing_time: new Date().toISOString(),
      success: false,
      reason: reason
    }
  };
};


/**
 * Construye el contexto del proyecto para Claude
 */
function buildProjectContext(projectData, options = {}) {
  console.log('🔍 Construyendo contexto para:', {
    type: projectData.type,
    location: projectData.location,
    area: projectData.area,
    description: projectData.description
  });

  return `
ANALIZAR PRESUPUESTO DE CONSTRUCCIÓN

PROYECTO ESPECÍFICO:
- Tipo: ${projectData.type || 'No especificado'}
- Ubicación: ${projectData.location || 'No especificada'}
- Área: ${projectData.area || 0} m²
- Descripción: ${projectData.description || 'Sin descripción'}
- Presupuesto estimado: $${(projectData.estimatedBudget || 0).toLocaleString('es-CL')} CLP

CONTEXTO ESPECÍFICO:
${projectData.description || `Proyecto ${projectData.type} de ${projectData.area}m² en ${projectData.location}`}

PARÁMETROS:
- Profundidad: ${options.analysisDepth || 'standard'}
- Incluir datos de mercado: ${options.includeMarketData ? 'Sí' : 'No'}
- Incluir proveedores: ${options.includeProviders ? 'Sí' : 'No'}

RESPONDER EN JSON:
{
  "resumen_ejecutivo": "Análisis específico del proyecto",
  "presupuesto_ajustado": "Monto en CLP",
  "desglose_detallado": {
    "estructura": {"porcentaje": "X%", "monto": "$X CLP"},
    "terminaciones": {"porcentaje": "X%", "monto": "$X CLP"},
    "instalaciones": {"porcentaje": "X%", "monto": "$X CLP"}
  },
  "factores_regionales": {
    "climaticos": "factores del clima en ${projectData.location}",
    "logisticos": "consideraciones logísticas",
    "mano_obra": "disponibilidad en ${projectData.location}"
  },
  "recomendaciones": ["recomendaciones específicas"],
  "cronograma_sugerido": "tiempo estimado para ${projectData.type}",
  "confidence_score": número
}
`;
}

/**
 * Parsea texto no-JSON a estructura
 */
function parseTextToStructured(text) {
  return {
    resumen_ejecutivo: "Análisis generado (formato texto recuperado)",
    contenido_original: text,
    presupuesto_ajustado: "Revisar manualmente",
    nota: "Respuesta requiere revisión manual - formato no estándar"
  };
}

/**
 * Calcula score de confianza basado en datos disponibles
 */
function calculateConfidenceScore(projectData) {
  let score = 0;
  const factors = [
    { field: 'type', weight: 20 },
    { field: 'location', weight: 25 },
    { field: 'area', weight: 20 },
    { field: 'estimatedBudget', weight: 15 },
    { field: 'description', weight: 10 },
    { field: 'startDate', weight: 10 }
  ];

  factors.forEach(factor => {
    if (projectData[factor.field] && projectData[factor.field] !== '') {
      score += factor.weight;
    }
  });

  return Math.min(score, 100); // Cap at 100%
}

/**
 * Estima costo de la llamada API
 */
function estimateApiCost(usage) {
  const inputTokens = usage.input_tokens || 1500; // Estimado
  const outputTokens = usage.output_tokens || 1000; // Estimado
  
  const inputCost = (inputTokens / 1000000) * 3.00; // $3 per 1M input tokens
  const outputCost = (outputTokens / 1000000) * 15.00; // $15 per 1M output tokens
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: inputCost + outputCost,
    estimated_cost_clp: (inputCost + outputCost) * 950 // Approx exchange rate
  };
}

/**
 * Analiza la estructura general del presupuesto
 */
async function analyzeGeneralStructure(firstChunk, config) {
  if (!firstChunk || firstChunk.length < 10) {
    throw new Error('Chunk vacío o muy pequeño para análisis');
  }

  const prompt = `
Analiza esta primera sección de un presupuesto de construcción chileno:

TEXTO DEL PRESUPUESTO:
${firstChunk.substring(0, 8000)}

RESPONDE EN FORMATO JSON:
{
  "tipo_proyecto": "Tipo identificado",
  "ubicacion_detectada": "Ubicación mencionada",
  "estructura_presupuesto": {
    "tiene_materiales": true/false,
    "tiene_mano_obra": true/false,
    "tiene_equipos": true/false,
    "formato_detectado": "descripción del formato"
  },
  "presupuesto_total_estimado": "Monto si se encuentra",
  "moneda_detectada": "CLP/USD/UF",
  "observaciones_generales": ["lista de observaciones"]
}

Contexto del proyecto: ${config.projectType} en ${config.projectLocation}`;

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 2000,
    temperature: 0.3,
    system: PDF_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }]
  });

  return parseJsonResponse(response.content[0].text, 'general_structure');
}

/**
 * Analiza contenido específico de cada chunk
 */
async function analyzeChunkContent(chunk, config, chunkIndex, totalChunks) {
  const prompt = `
Analiza esta sección de un presupuesto de construcción (Chunk ${chunkIndex}/${totalChunks}):

TEXTO:
${chunk.content}

Identifica y extrae cualquier información relevante:
- Materiales y cantidades
- Mano de obra y tarifas  
- Equipos y costos
- Proveedores mencionados
- Subtotales parciales
- Observaciones técnicas

RESPONDER EN FORMATO JSON con la estructura más apropiada según el contenido encontrado.`;

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 3000,
    temperature: 0.2,
    system: PDF_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }]
  });

  return parseJsonResponse(response.content[0].text, `chunk_${chunkIndex}`);
}

/**
 * Consolida datos de cada chunk analizado
 */
function consolidateChunkData(chunkAnalysis, consolidatedData) {
  if (chunkAnalysis.materiales) {
    consolidatedData.materials.push(...chunkAnalysis.materiales);
  }
  
  if (chunkAnalysis.mano_obra) {
    consolidatedData.labor.push(...chunkAnalysis.mano_obra);
  }
  
  if (chunkAnalysis.equipos) {
    consolidatedData.equipment.push(...chunkAnalysis.equipos);
  }
  
  if (chunkAnalysis.proveedores_mencionados) {
    consolidatedData.providers.push(...chunkAnalysis.proveedores_mencionados);
  }
}

/**
 * Genera consolidación y síntesis final
 */
async function generateFinalConsolidation(consolidatedData, results, config) {
  const prompt = `
Basándote en el análisis detallado de un presupuesto de construcción chileno, genera una síntesis final:

DATOS CONSOLIDADOS:
- Materiales encontrados: ${consolidatedData.materials.length}
- Mano de obra: ${consolidatedData.labor.length}  
- Equipos: ${consolidatedData.equipment.length}
- Proveedores: ${consolidatedData.providers.length}

MATERIALES PRINCIPALES:
${JSON.stringify(consolidatedData.materials.slice(0, 10), null, 2)}

MANO DE OBRA PRINCIPAL:
${JSON.stringify(consolidatedData.labor.slice(0, 5), null, 2)}

RESPONDE EN FORMATO JSON:
{
  "executive_summary": "Resumen ejecutivo del presupuesto en 3-4 líneas",
  "estimated_budget": {
    "total_clp": número,
    "materials_percentage": número,
    "labor_percentage": número,
    "equipment_percentage": número,
    "overhead_percentage": número
  },
  "cost_breakdown": {
    "materiales": número,
    "mano_obra": número,
    "equipos": número,
    "gastos_generales": número,
    "utilidad": número,
    "total": número
  },
  "risk_analysis": [
    {
      "factor": "descripción del riesgo",
      "probability": "alta/media/baja",
      "impact": "alto/medio/bajo",
      "mitigation": "estrategia de mitigación"
    }
  ],
  "recommendations": [
    "Recomendación específica 1",
    "Recomendación específica 2",
    "Recomendación específica 3"
  ],
  "timeline": "Cronograma estimado en meses",
  "regional_factors": {
    "climate_impact": "Impacto climático en Chile",
    "logistics": "Consideraciones logísticas",
    "local_regulations": "Regulaciones aplicables",
    "market_conditions": "Condiciones del mercado actual"
  }
}

CONTEXTO: Proyecto ${config.projectType} en ${config.projectLocation}
Considera factores específicos del mercado de construcción chileno.`;

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 4000,
    temperature: 0.3,
    system: PDF_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }]
  });

  return parseJsonResponse(response.content[0].text, 'final_consolidation');
}

/**
 * Crea consolidación de fallback cuando hay errores
 */
function createFallbackConsolidation(consolidatedData, results) {
  return {
    executive_summary: `Análisis parcialmente completado. Procesados ${results.length} chunks con ${results.filter(r => !r.error).length} exitosos.`,
    estimated_budget: {
      total_clp: 0,
      note: "Estimación requiere análisis manual"
    },
    risk_analysis: [{
      factor: "Análisis incompleto",
      probability: "alta", 
      impact: "medio",
      mitigation: "Revisar y procesar nuevamente el documento"
    }],
    recommendations: [
      "Verificar la calidad del documento PDF",
      "Considerar dividir documentos muy largos",
      "Revisar manualmente los datos extraídos"
    ],
    timeline: "Requiere análisis adicional",
    cost_breakdown: {},
    regional_factors: {
      note: "Factores regionales requieren análisis manual"
    }
  };
}

/**
 * Calcula score de confianza para análisis PDF
 */
function calculatePdfConfidenceScore(results, consolidatedData) {
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

/**
 * Parsea respuesta JSON con manejo de errores
 */
function parseJsonResponse(text, context) {
  try {
    // Buscar JSON en la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Si no hay JSON válido, crear estructura básica
    console.warn(`⚠️ No se pudo parsear JSON en ${context}, creando estructura básica`);
    return {
      raw_text: text,
      parsing_error: true,
      context: context
    };
  } catch (error) {
    console.warn(`⚠️ Error parseando JSON en ${context}:`, error.message);
    return {
      raw_text: text,
      parsing_error: true,
      error: error.message,
      context: context
    };
  }
}

// ====================================================================
// 🎯 PROMPTS Y CONFIGURACIONES
// ====================================================================

/**
 * System prompt especializado para análisis presupuestario
 */
const SYSTEM_PROMPT = `Eres un experto en presupuestos de construcción especializado en el mercado chileno. Tu expertise incluye:

- Costos específicos por región de Chile
- Factores climáticos y geográficos que afectan presupuestos
- Conocimiento de proveedores principales (Sodimac, Construmart, Easy)
- Regulaciones y normativas de construcción chilenas
- Análisis de riesgos específicos por zona geográfica

INSTRUCCIONES:
1. Analiza ÚNICAMENTE proyectos de construcción
2. Proporciona estimaciones realistas basadas en el mercado chileno
3. Incluye factores de riesgo específicos por región
4. Sugiere contingencias apropiadas
5. Responde SIEMPRE en formato JSON estructurado

NO hagas:
- Análisis de otros tipos de proyectos
- Recomendaciones legales o de inversión
- Estimaciones sin suficiente información base`;

/**
 * System prompt especializado para análisis de PDFs
 */
const PDF_ANALYSIS_SYSTEM_PROMPT = `
Eres un experto analista de presupuestos de construcción especializado en el mercado chileno. 

Tu trabajo es extraer información detallada y precisa de presupuestos de construcción, identificando:
- Materiales con cantidades, unidades y precios
- Mano de obra con especialidades, horas y tarifas
- Equipos con costos de arriendo y operación
- Proveedores chilenos mencionados
- Factores regionales específicos de Chile

IMPORTANTE:
- Siempre responde en formato JSON válido
- Convierte texto a números cuando sea apropiado
- Mantén consistencia en unidades de medida
- Identifica correctamente la moneda (CLP/UF/USD)
- Considera factores del mercado chileno (IVA, regulaciones, costos logísticos)
- Si un dato no está claro, usar null en lugar de inventar valores

Para el mercado chileno considera:
- Precios incluyen/excluyen IVA
- Factores climáticos por región
- Disponibilidad de mano de obra especializada
- Costos de transporte según ubicación
- Regulaciones locales aplicables
`;