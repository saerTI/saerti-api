// src/services/claudeService.mjs
// 🔥 VERSIÓN LIMPIA - SOLO FUNCIONES UTILIZADAS
import config from '../config/config.mjs';
import Anthropic from '@anthropic-ai/sdk';

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
 * 🔥 FUNCIÓN PRINCIPAL 2: Genera análisis detallado de PDF usando múltiples consultas a Claude
 * @param {Array} chunks - Chunks de texto del PDF
 * @param {Object} config - Configuración del análisis
 * @param {Object} analysisConfig - Configuración específica del análisis
 * @param {string} analysisId - ID único del análisis
 * @returns {Promise<Object>} - Análisis consolidado
 */
export const generateDetailedPdfAnalysis = async (chunks, config, analysisConfig, analysisId) => {
  try {
    console.log(`🤖 Iniciando análisis detallado PDF con ${chunks.length} chunks`);
    
    if (!chunks || chunks.length === 0) {
      throw new Error('No hay chunks para analizar');
    }
    
    const results = [];
    const consolidatedData = {
      materials: [],
      labor: [],
      equipment: [],
      providers: [],
      sections: []
    };

    // 🔥 ANÁLISIS GENERAL CON VALIDACIONES
    console.log('📋 Fase 1: Análisis general del presupuesto');
    try {
      const generalAnalysis = await analyzeGeneralStructure(chunks[0]?.content || '', config);
      results.push({ type: 'general', data: generalAnalysis });
    } catch (generalError) {
      console.warn('⚠️ Error en análisis general:', generalError.message);
      results.push({ type: 'general', error: generalError.message });
    }

    // 🔥 ANÁLISIS DE CHUNKS CON LÍMITES Y TIMEOUTS
    console.log('🔍 Fase 2: Análisis detallado por secciones');
    for (let i = 0; i < Math.min(chunks.length, 10); i++) { // Limitar a 10 chunks máximo
      const chunk = chunks[i];
      console.log(`📝 Procesando chunk ${i + 1}/${Math.min(chunks.length, 10)} (${chunk.type})`);
      
      try {
        const chunkAnalysis = await analyzeChunkContent(chunk, config, i + 1, chunks.length);
        results.push({ 
          type: chunk.type, 
          chunkIndex: i + 1,
          data: chunkAnalysis 
        });

        // Consolidar datos específicos
        consolidateChunkData(chunkAnalysis, consolidatedData);
        
        // 🔥 PAUSA OBLIGATORIA PARA EVITAR RATE LIMITING
        if (i < Math.min(chunks.length, 10) - 1) {
          console.log('⏳ Pausa para rate limiting...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
        }
        
      } catch (chunkError) {
        console.warn(`⚠️ Error procesando chunk ${i + 1}:`, chunkError.message);
        results.push({ 
          type: chunk.type, 
          chunkIndex: i + 1,
          error: chunkError.message 
        });
      }
    }

    // 🔥 CONSOLIDACIÓN FINAL CON VALIDACIONES
    console.log('🔄 Fase 3: Consolidación y síntesis final');
    let finalConsolidation;
    try {
      finalConsolidation = await generateFinalConsolidation(
        consolidatedData, 
        results, 
        config
      );
    } catch (consolidationError) {
      console.warn('⚠️ Error en consolidación final:', consolidationError.message);
      finalConsolidation = createFallbackConsolidation(consolidatedData, results);
    }

    // 🔥 RESPUESTA FINAL ROBUSTA
    const finalAnalysis = {
      resumen_ejecutivo: finalConsolidation.executive_summary || "Análisis completado con datos parciales",
      presupuesto_estimado: finalConsolidation.estimated_budget || { total_clp: 0 },
      materiales_detallados: consolidatedData.materials || [],
      mano_obra: consolidatedData.labor || [],
      equipos_maquinaria: consolidatedData.equipment || [],
      proveedores_chile: analysisConfig.includeProviders ? consolidatedData.providers : [],
      analisis_riesgos: finalConsolidation.risk_analysis || [],
      recomendaciones: finalConsolidation.recommendations || [],
      cronograma_estimado: finalConsolidation.timeline || "Requiere análisis adicional",
      desglose_costos: finalConsolidation.cost_breakdown || {},
      factores_regionales: finalConsolidation.regional_factors || {},
      chunks_procesados: Math.min(chunks.length, 10),
      chunks_exitosos: results.filter(r => !r.error).length,
      confidence_score: calculatePdfConfidenceScore(results, consolidatedData),
      metadata: {
        analysis_id: analysisId,
        model_used: config.anthropic.model,
        processing_time: new Date().toISOString(),
        success: true
      }
    };

    console.log('✅ Análisis PDF completado exitosamente');
    return finalAnalysis;

  } catch (error) {
    console.error('❌ Error en generateDetailedPdfAnalysis:', error);
    
    // 🔥 RETORNAR ERROR ESTRUCTURADO EN LUGAR DE FALLAR
    return {
      error: true,
      message: error.message,
      resumen_ejecutivo: "Error en el análisis del PDF",
      presupuesto_estimado: { total_clp: 0, error: true },
      materiales_detallados: [],
      mano_obra: [],
      equipos_maquinaria: [],
      analisis_riesgos: [{
        factor: "Error en procesamiento",
        probability: "alta",
        impact: "alto",
        mitigation: "Revisar archivo y reintentar"
      }],
      recomendaciones: ["Verificar que el archivo PDF no esté corrupto", "Intentar con un archivo más pequeño"],
      confidence_score: 0,
      metadata: {
        error: true,
        error_message: error.message,
        model_used: config.anthropic.model,
        processing_time: new Date().toISOString()
      }
    };
  }
};

// ====================================================================
// 🔧 FUNCIONES AUXILIARES INTERNAS (SOLO LAS QUE SE USAN)
// ====================================================================

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