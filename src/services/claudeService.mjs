import config from '../config/config.mjs';
// src/services/claudeService.mjs
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
 * Genera sugerencias presupuestarias usando Claude
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
      model: config.anthropic.model, // Usar modelo validado
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
      processing_time_ms: Date.now() - Date.now(), // Puedes agregar timing real aquí
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
 * Obtiene factores regionales específicos
 */
function getRegionalFactors(location) {
  const factors = {
    'valdivia': {
      clima: '45 días lluvia/año, planificar protecciones',
      logistica: 'Distancia Santiago +12% costo transporte',
      mano_obra: 'Disponibilidad limitada especializada +15%',
      sismica: 'Zona sísmica 3, refuerzos requeridos'
    },
    'santiago': {
      clima: 'Estable, sin factores climáticos críticos',
      logistica: 'Centro de distribución, costos base',
      mano_obra: 'Amplia disponibilidad, precios competitivos',
      sismica: 'Zona sísmica 2-3, normativas estrictas'
    },
    'antofagasta': {
      clima: 'Árido, considerar protección UV y vientos',
      logistica: 'Puerto cercano pero +18% vs Santiago',
      mano_obra: 'Alta demanda minera +25% costos',
      sismica: 'Zona sísmica 2, estándares altos'
    }
  };

  const city = location.toLowerCase();
  const cityFactors = factors[city] || factors['santiago']; // Default Santiago
  
  return Object.entries(cityFactors)
    .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
    .join('\n');
}

/**
 * Contexto general del mercado chileno
 */
function getMarketContext() {
  return `
Tendencias 2024-2025:
- Cemento: Precio estable ~$7.800/saco
- Acero: Volatilidad +/-15% por factores internacionales  
- Mano obra: Incremento 8% anual promedio
- Transportes: Combustible afecta +/-5% costos logística
- Normativas: Nueva norma sísmica NCh433 en vigor

Estacionalidad:
- Marzo-Mayo: Temporada óptima, menor lluvia
- Junio-Agosto: Invierno, factores climáticos críticos
- Sept-Nov: Primavera, buena para fundaciones
- Dic-Feb: Verano, cuidado alta demanda mano obra`;
}

/**
 * Genera instrucciones según profundidad de análisis
 */
function getAnalysisInstructions(depth) {
  const instructions = {
    'basic': `
RESPONDE EN FORMATO JSON:
{
  "resumen_ejecutivo": "Análisis en 2-3 líneas",
  "presupuesto_ajustado": "Monto en CLP",
  "desglose_principal": {
    "estructura": "% y monto",
    "terminaciones": "% y monto", 
    "instalaciones": "% y monto"
  },
  "factores_riesgo": ["lista de 3-5 riesgos principales"],
  "contingencia_recomendada": "% sugerido"
}`,

    'standard': `
RESPONDE EN FORMATO JSON:
{
  "resumen_ejecutivo": "Análisis detallado",
  "presupuesto_ajustado": "Monto ajustado en CLP",
  "desglose_detallado": {
    "estructura": {"porcentaje": "", "monto": "", "observaciones": ""},
    "albañilería": {"porcentaje": "", "monto": "", "observaciones": ""},
    "terminaciones": {"porcentaje": "", "monto": "", "observaciones": ""},
    "instalaciones": {"porcentaje": "", "monto": "", "observaciones": ""},
    "otros": {"porcentaje": "", "monto": "", "observaciones": ""}
  },
  "factores_regionales": {
    "climaticos": "Impacto específico",
    "logisticos": "Sobrecostos transporte",
    "mano_obra": "Disponibilidad y precios",
    "normativos": "Regulaciones aplicables"
  },
  "analisis_riesgos": [
    {"riesgo": "", "probabilidad": "", "impacto": "", "mitigacion": ""}
  ],
  "recomendaciones": ["lista de recomendaciones específicas"],
  "cronograma_sugerido": "Duración estimada y fases críticas",
  "contingencia_recomendada": "% y justificación"
}`,

    'detailed': `
INCLUIR TAMBIÉN:
- Comparación con proyectos similares
- Análisis de sensibilidad de costos
- Recomendaciones de proveedores
- Optimizaciones específicas
- Plan de monitoreo de costos`
  };

  return instructions[depth] || instructions['standard'];
}

/**
 * Parsea texto no-JSON a estructura
 */
function parseTextToStructured(text) {
  // Implementación básica para convertir respuesta texto a JSON
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
 * Extrae región de ubicación
 */
function extractRegion(location) {
  if (!location) return 'No especificada';
  
  const regions = {
    'santiago': 'Metropolitana',
    'valdivia': 'Los Ríos', 
    'concepción': 'Biobío',
    'antofagasta': 'Antofagasta',
    'valparaíso': 'Valparaíso'
  };
  
  const city = location.toLowerCase();
  return regions[city] || 'Región no identificada';
}

/**
 * Formatea moneda chilena
 */
function formatCurrency(amount) {
  if (!amount) return 'No especificado';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Genera análisis detallado de PDF usando múltiples consultas a Claude
 * @param {Array} chunks - Chunks de texto del PDF
 * @param {Object} config - Configuración del análisis
 * @param {string} analysisId - ID único del análisis
 * @returns {Promise<Object>} - Análisis consolidado
 */
export const generateDetailedPdfAnalysis = async (chunks, config, analysisConfig, analysisId) => {

console.log("🔍 DEBUG generateDetailedPdfAnalysis - config:", !!config);
console.log("🔍 DEBUG generateDetailedPdfAnalysis - config.anthropic:", !!config?.anthropic);
console.log("🔍 DEBUG generateDetailedPdfAnalysis - config.anthropic.model:", config?.anthropic?.model);
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
  const sectionPrompts = {
    'materials': generateMaterialsPrompt(chunk, config, chunkIndex, totalChunks),
    'labor': generateLaborPrompt(chunk, config, chunkIndex, totalChunks),
    'equipment': generateEquipmentPrompt(chunk, config, chunkIndex, totalChunks),
    'general': generateGeneralChunkPrompt(chunk, config, chunkIndex, totalChunks)
  };

  const prompt = sectionPrompts[chunk.type] || sectionPrompts['general'];

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
 * Genera prompt especializado para materiales
 */
function generateMaterialsPrompt(chunk, config, chunkIndex, totalChunks) {
  return `
Analiza esta sección de MATERIALES de un presupuesto de construcción (Chunk ${chunkIndex}/${totalChunks}):

TEXTO:
${chunk.content}

EXTRAER EN FORMATO JSON:
{
  "materiales": [
    {
      "item": "Nombre del material",
      "descripcion": "Descripción completa",
      "cantidad": número,
      "unidad": "m2/m3/kg/unidades/etc",
      "precio_unitario": número,
      "subtotal": número,
      "categoria": "hormigon/acero/madera/instalaciones/etc",
      "especificaciones": "detalles técnicos",
      "proveedor_sugerido": "si se menciona"
    }
  ],
  "subtotal_seccion": número,
  "observaciones": ["notas importantes"],
  "proveedores_mencionados": [
    {
      "nombre": "Nombre del proveedor",
      "contacto": "teléfono/email si disponible",
      "especialidad": "tipo de materiales"
    }
  ]
}

IMPORTANTE:
- Convertir todas las cantidades a números
- Identificar correctamente las unidades de medida
- Calcular subtotales si no están explícitos
- Incluir solo materiales reales, no títulos de sección`;
}

/**
 * Genera prompt especializado para mano de obra
 */
function generateLaborPrompt(chunk, config, chunkIndex, totalChunks) {
  return `
Analiza esta sección de MANO DE OBRA de un presupuesto (Chunk ${chunkIndex}/${totalChunks}):

TEXTO:
${chunk.content}

EXTRAER EN FORMATO JSON:
{
  "mano_obra": [
    {
      "especialidad": "Albañil/Electricista/Plomero/etc",
      "descripcion_trabajo": "Descripción de la actividad",
      "cantidad_personas": número,
      "horas_por_persona": número,
      "horas_totales": número,
      "tarifa_hora": número,
      "tarifa_dia": número,
      "subtotal": número,
      "nivel_especialidad": "ayudante/oficial/maestro/jefe",
      "region_aplicable": "si se especifica"
    }
  ],
  "subtotal_mano_obra": número,
  "observaciones": ["notas sobre rendimientos, condiciones"],
  "factores_especiales": {
    "trabajo_altura": true/false,
    "condiciones_especiales": "descripción si aplica",
    "horario_especial": "nocturno/festivo/etc"
  }
}

CONTEXTO: Proyecto ${config.projectType} en ${config.projectLocation}`;
}

/**
 * Genera prompt especializado para equipos
 */
function generateEquipmentPrompt(chunk, config, chunkIndex, totalChunks) {
  return `
Analiza esta sección de EQUIPOS/MAQUINARIA de un presupuesto (Chunk ${chunkIndex}/${totalChunks}):

TEXTO:
${chunk.content}

EXTRAER EN FORMATO JSON:
{
  "equipos": [
    {
      "tipo_equipo": "Grúa/Excavadora/Mixer/etc",
      "descripcion": "Especificaciones técnicas",
      "tiempo_uso": "días/horas/semanas",
      "tarifa_periodo": número,
      "costo_transporte": número,
      "costo_operador": número,
      "costo_combustible": número,
      "subtotal": número,
      "categoria": "movimiento_tierras/elevacion/transporte/etc"
    }
  ],
  "subtotal_equipos": número,
  "observaciones": ["notas sobre disponibilidad, condiciones"],
  "proveedores_equipos": [
    {
      "nombre": "Empresa de arriendo",
      "contacto": "si disponible",
      "especialidad": "tipo de equipos"
    }
  ]
}`;
}

/**
 * Genera prompt general para chunks no clasificados
 */
function generateGeneralChunkPrompt(chunk, config, chunkIndex, totalChunks) {
  return `
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

// System prompt especializado para análisis de PDFs
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

// Agregar esta función a tu src/services/claudeService.mjs
/**
 * Analiza imágenes de documentos usando Claude Vision
 * 🔥 Nueva función para analizar PDFs escaneados/con imágenes
 */
/**
 * Analiza documentos usando Claude Vision (versión mejorada)
 * Puede manejar PDFs directamente sin conversión a imágenes
 */
export async function analyzeDocumentImages(images, analysisConfig = {}) {
  try {
    console.log(`🤖 Analizando documento con Claude Sonnet 4...`);
    
    if (!images || images.length === 0) {
      throw new Error('No se proporcionaron documentos para analizar');
    }
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('API key de Anthropic no configurada');
    }

    const prompt = `
Eres un experto analista de presupuestos de construcción chileno. Analiza este documento PDF y extrae TODA la información.

RESPONDER EN JSON ESTRUCTURADO:
{
  "resumen_ejecutivo": "Resumen completo del documento",
  "presupuesto_estimado": {
    "total_clp": número,
    "materials_percentage": número,
    "labor_percentage": número,
    "equipment_percentage": número
  },
  "materiales_detallados": [
    {
      "item": "nombre del material",
      "cantidad": número,
      "unidad": "m2/m3/kg/unidades",
      "precio_unitario": número,
      "subtotal": número,
      "categoria": "hormigon/acero/madera/instalaciones"
    }
  ],
  "mano_obra": [
    {
      "especialidad": "tipo de trabajo",
      "cantidad_personas": número,
      "horas_totales": número,
      "tarifa_hora": número,
      "subtotal": número
    }
  ],
  "equipos_maquinaria": [
    {
      "tipo_equipo": "descripción",
      "tiempo_uso": "período",
      "tarifa_periodo": número,
      "subtotal": número
    }
  ],
  "proveedores_chile": [
    {
      "nombre": "nombre del proveedor",
      "contacto": "información de contacto",
      "especialidad": "área de especialización"
    }
  ],
  "analisis_riesgos": [
    {
      "factor": "descripción del riesgo",
      "probability": "alta/media/baja",
      "impact": "alto/medio/bajo",
      "mitigation": "estrategia de mitigación"
    }
  ],
  "recomendaciones": ["lista de recomendaciones específicas"],
  "cronograma_estimado": "descripción del cronograma sugerido",
  "confidence_score": número_entre_70_y_100
}

INSTRUCCIONES ESPECÍFICAS:
- Extrae TODO el texto visible de todas las páginas
- Identifica todos los ítems con precios y cantidades
- Calcula totales y subtotales cuando no estén explícitos
- Incluye factores específicos del mercado chileno
- Mantén precisión en números y unidades de medida
`;

    // 🔥 LIMPIAR IMÁGENES
    const cleanedImages = images.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.source.media_type || 'image/png',
        data: img.source.data
      }
    }));

    console.log(`🚀 Enviando ${cleanedImages.length} imágenes a Claude Sonnet 4...`);

    // 🔥 USAR CONFIGURACIÓN CORRECTA
    const response = await anthropic.messages.create({
      model: config.anthropic.model, // 🔥 CLAVE: USA TU CONFIG
      max_tokens: config.anthropic.maxTokens,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...cleanedImages
        ]
      }]
    });

    const analysisText = response.content[0].text;
    console.log('✅ Claude Sonnet 4 completó el análisis');

    // Parsear respuesta JSON
    let parsedResult;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
        console.log(`📊 Análisis completado: ${parsedResult.materiales_detallados?.length || 0} materiales`);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.warn('⚠️ Error parseando JSON, usando análisis como texto');
      parsedResult = {
        resumen_ejecutivo: analysisText,
        presupuesto_estimado: { total_clp: 0 },
        materiales_detallados: [],
        mano_obra: [],
        equipos_maquinaria: [],
        proveedores_chile: [],
        analisis_riesgos: [],
        recomendaciones: [],
        cronograma_estimado: '',
        confidence_score: 75,
        parsing_error: true,
        raw_response: analysisText
      };
    }

    return {
      ...parsedResult,
      processing_info: {
        model_used: config.anthropic.model,
        processing_time: new Date().toISOString(),
        images_processed: cleanedImages.length
      }
    };

  } catch (error) {
    console.error('❌ Error en Claude Sonnet 4:', error);
    throw error;
  }
}

/**
 * Convierte PDF a imágenes para análisis con Claude Vision
 * Usa pdf2pic para convertir páginas PDF a imágenes
 */
export async function convertPdfToImages(pdfBuffer, options = {}) {
  try {
    // Importación dinámica de pdf2pic
    const { fromBuffer } = await import('pdf2pic');
    
    const convert = fromBuffer(pdfBuffer, {
      density: options.density || 200,           // DPI
      saveFilename: "page",
      savePath: "./temp/",
      format: "png",
      width: options.width || 1200,
      height: options.height || 1600,
      quality: options.quality || 100
    });

    console.log('🖼️ Convirtiendo PDF a imágenes...');
    
    // Convertir todas las páginas
    const results = await convert.bulk(-1, { responseType: "buffer" });
    
    if (!results || results.length === 0) {
      throw new Error('No se pudieron generar imágenes del PDF');
    }

    // Preparar imágenes para Claude Vision
    const images = results.map((result, index) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: result.buffer.toString('base64')
      }
    }));

    console.log(`✅ PDF convertido a ${images.length} imágenes`);
    return images;

  } catch (error) {
    console.error('❌ Error convirtiendo PDF a imágenes:', error);
    throw new Error(`Error en conversión PDF a imágenes: ${error.message}`);
  }
}

/**
 * Análisis completo de PDF con imágenes usando Claude Vision
 * Esta función maneja todo el flujo: PDF → Imágenes → Análisis con Claude
 */
export async function analyzePdfWithVision(pdfBuffer, config = {}) {
  try {
    console.log('🔍 Iniciando análisis PDF con Claude Vision...');
    
    // 1. Convertir PDF a imágenes
    const images = await convertPdfToImages(pdfBuffer, {
      density: 200,
      quality: 100
    });

    // 2. Analizar imágenes con Claude Vision
    const analysis = await analyzeDocumentImages(images, config);

    console.log('✅ Análisis PDF con Vision completado');
    
    return {
      ...analysis,
      extraction_method: 'claude_vision',
      images_analyzed: images.length,
      vision_analysis: true
    };

  } catch (error) {
    console.error('❌ Error en análisis PDF con Vision:', error);
    
    // Errores específicos para mejor UX
    if (error.message.includes('pdf2pic')) {
      throw new Error(
        'Servicio de conversión PDF no disponible. ' +
        'Para PDFs con imágenes, use un conversor OCR online primero.'
      );
    }
    
    throw new Error(`Error en análisis PDF con visión: ${error.message}`);
  }
}