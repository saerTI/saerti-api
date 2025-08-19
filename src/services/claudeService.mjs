// src/services/claudeService.mjs
import Anthropic from '@anthropic-ai/sdk';
import config from '../config/config.mjs';

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
    console.log('🤖 Iniciando análisis con Claude para proyecto:', projectData.name || 'Sin nombre');
    
    // Construir contexto rico para Claude
    const contextPrompt = buildProjectContext(projectData, options);
    
    // Llamada a Claude API usando configuración
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      temperature: config.anthropic.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: contextPrompt
        }
      ]
    });

    // Parsear respuesta
    const analysisText = response.content[0].text;
    console.log('✅ Respuesta recibida de Claude, parseando...');
    
    // Intentar parsear JSON, con fallback a texto estructurado
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.warn('⚠️ Respuesta no es JSON válido, creando estructura...');
      analysis = parseTextToStructured(analysisText);
    }

    // Agregar metadatos
    analysis.metadata = {
      generated_at: new Date().toISOString(),
      model_used: "claude-3-5-sonnet",
      project_id: projectData.id || null,
      confidence_score: calculateConfidenceScore(projectData),
      api_cost_estimate: estimateApiCost(response.usage || {})
    };

    console.log('✅ Análisis completado exitosamente');
    return analysis;

  } catch (error) {
    console.error('❌ Error en generateBudgetSuggestions:', error);
    
    // Manejo específico de errores de Anthropic
    if (error.status === 401) {
      throw new Error('API key de Anthropic inválida o expirada');
    } else if (error.status === 429) {
      throw new Error('Límite de rate limit alcanzado. Intente nuevamente en unos minutos');
    } else if (error.status === 400) {
      throw new Error('Datos del proyecto inválidos para análisis');
    }
    
    throw new Error(`Error en análisis AI: ${error.message}`);
  }
};

/**
 * Construye el contexto del proyecto para Claude
 */
function buildProjectContext(projectData, options) {
  const {
    includeMarketData = true,
    includeHistoricalData = false,
    analysisDepth = 'standard'
  } = options;

  let context = `
ANÁLISIS PRESUPUESTARIO - PROYECTO DE CONSTRUCCIÓN CHILE

=== DATOS DEL PROYECTO ===
Nombre: ${projectData.name || 'Proyecto sin nombre'}
Tipo: ${projectData.type || 'No especificado'}
Ubicación: ${projectData.location || 'No especificada'}
Región: ${extractRegion(projectData.location)}
Área construida: ${projectData.area || 'No especificada'} m²
Presupuesto estimado: ${formatCurrency(projectData.estimatedBudget)} CLP
Fecha inicio: ${projectData.startDate || 'No especificada'}
Cliente: ${projectData.client || 'No especificado'}

=== CONTEXTO ADICIONAL ===`;

  // Agregar descripción si existe
  if (projectData.description) {
    context += `\nDescripción: ${projectData.description}`;
  }

  // Agregar datos de ubicación específica
  if (projectData.location) {
    context += `\n
=== FACTORES REGIONALES ===
Zona geográfica: ${projectData.location}
${getRegionalFactors(projectData.location)}`;
  }

  // Agregar datos de mercado si está habilitado
  if (includeMarketData) {
    context += `\n
=== CONTEXTO DE MERCADO CHILE ===
${getMarketContext()}`;
  }

  // Instrucciones específicas según profundidad
  context += getAnalysisInstructions(analysisDepth);

  return context;
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
export const generateDetailedPdfAnalysis = async (chunks, config, analysisId) => {
  try {
    console.log(`🤖 Iniciando análisis detallado PDF con ${chunks.length} chunks`);
    
    const results = [];
    const consolidatedData = {
      materials: [],
      labor: [],
      equipment: [],
      providers: [],
      sections: []
    };

    // Paso 1: Análisis general y estructura
    console.log('📋 Fase 1: Análisis general del presupuesto');
    const generalAnalysis = await analyzeGeneralStructure(chunks[0]?.content || '', config);
    results.push({ type: 'general', data: generalAnalysis });

    // Paso 2: Análisis de chunks específicos
    console.log('🔍 Fase 2: Análisis detallado por secciones');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📝 Procesando chunk ${i + 1}/${chunks.length} (${chunk.type})`);
      
      try {
        const chunkAnalysis = await analyzeChunkContent(chunk, config, i + 1, chunks.length);
        results.push({ 
          type: chunk.type, 
          chunkIndex: i + 1,
          data: chunkAnalysis 
        });

        // Consolidar datos específicos
        consolidateChunkData(chunkAnalysis, consolidatedData);
        
        // Pausa pequeña para evitar rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Paso 3: Consolidación final
    console.log('🔄 Fase 3: Consolidación y síntesis final');
    const finalConsolidation = await generateFinalConsolidation(
      consolidatedData, 
      results, 
      config
    );

    // Construir respuesta final
    const finalAnalysis = {
      resumen_ejecutivo: finalConsolidation.executive_summary,
      presupuesto_estimado: finalConsolidation.estimated_budget,
      materiales_detallados: consolidatedData.materials,
      mano_obra: consolidatedData.labor,
      equipos_maquinaria: consolidatedData.equipment,
      proveedores_chile: config.includeProviders ? consolidatedData.providers : [],
      analisis_riesgos: finalConsolidation.risk_analysis,
      recomendaciones: finalConsolidation.recommendations,
      cronograma_estimado: finalConsolidation.timeline,
      desglose_costos: finalConsolidation.cost_breakdown,
      factores_regionales: finalConsolidation.regional_factors,
      chunks_procesados: chunks.length,
      chunks_exitosos: results.filter(r => !r.error).length,
      confidence_score: calculatePdfConfidenceScore(results, consolidatedData)
    };

    console.log('✅ Análisis PDF completado exitosamente');
    return finalAnalysis;

  } catch (error) {
    console.error('❌ Error en generateDetailedPdfAnalysis:', error);
    throw new Error(`Error en análisis PDF: ${error.message}`);
  }
};

/**
 * Analiza la estructura general del presupuesto
 */
async function analyzeGeneralStructure(firstChunk, config) {
  const prompt = `
Analiza esta primera sección de un presupuesto de construcción chileno y identifica:

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

Contexto del proyecto: ${config.projectType} en ${config.projectLocation}
Incluir factores específicos del mercado chileno.`;

  const response = await anthropic.messages.create({
    model: config.anthropic?.model || "claude-3-5-sonnet-20241022",
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
    model: config.anthropic?.model || "claude-3-5-sonnet-20241022",
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
    model: config.anthropic?.model || "claude-3-5-sonnet-20241022",
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
export async function analyzeDocumentImages(images, config = {}) {
  try {
    console.log(`🤖 Analizando documento con Claude Vision...`);
    
    if (!images || images.length === 0) {
      throw new Error('No se proporcionaron documentos para analizar');
    }
    
    // Verificar API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('API key de Anthropic no configurada');
    }
    
    // Prompt especializado para presupuestos de construcción
    const analysisPrompt = `
Eres un experto analista de presupuestos de construcción chileno. Analiza este documento y extrae TODA la información relevante.

INSTRUCCIONES ESPECÍFICAS:
1. Extrae TODO el texto visible
2. Identifica elementos del presupuesto:
   - Partidas y códigos de obra
   - Materiales con cantidades y precios unitarios
   - Mano de obra con horas y tarifas
   - Equipos y maquinaria
   - Subcontratos y servicios
   - Totales parciales y generales
3. Mantén la estructura y formato original
4. Para tablas, preserva columnas y filas
5. Identifica proveedores y especificaciones técnicas
6. Busca fechas, ubicaciones y datos del proyecto

FORMATO DE RESPUESTA - Devuelve SOLO este JSON:
{
  "extracted_text": "Todo el texto extraído con formato original",
  "budget_items": [
    {
      "code": "código si existe",
      "description": "descripción completa",
      "quantity": número,
      "unit": "unidad (m2, ml, kg, etc)",
      "unit_price": número,
      "total_price": número,
      "category": "material|labor|equipment|subcontract|other"
    }
  ],
  "totals": {
    "materials": número_o_null,
    "labor": número_o_null, 
    "equipment": número_o_null,
    "subtotal": número_o_null,
    "total": número_o_null
  },
  "metadata": {
    "project_name": "nombre si se identifica",
    "date": "fecha si se identifica",
    "location": "ubicación si se identifica",
    "document_type": "especificaciones_tecnicas|presupuesto|cotizacion|otro"
  },
  "confidence": número_entre_1_y_100,
  "analysis": "Resumen ejecutivo del documento"
}

CONTEXTO CHILENO: Presta atención a:
- Códigos BIM o especificaciones NCh (normas chilenas)
- Precios en pesos chilenos (CLP, $)
- Términos técnicos de construcción en español
- Unidades métricas (m2, m3, kg, ton, etc.)

Analiza minuciosamente y extrae TODO el contenido posible.
`;

    // Preparar mensaje para Claude
    const messageContent = [
      { type: 'text', text: analysisPrompt },
      ...images
    ];

    // Llamar a Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.1, // Baja temperatura para máxima precisión
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ]
    });

    const analysisText = response.content[0].text;
    console.log('✅ Claude Vision completó el análisis');

    // Parsear respuesta JSON
    let parsedResult;
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
        console.log(`📊 Datos extraídos: ${parsedResult.budget_items?.length || 0} items`);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.warn('⚠️ Error parseando JSON, usando análisis como texto');
      parsedResult = {
        extracted_text: analysisText,
        budget_items: [],
        totals: {},
        metadata: { document_type: 'unknown' },
        confidence: 75,
        analysis: 'Análisis de texto sin estructura JSON',
        parsing_error: true,
        raw_response: analysisText
      };
    }

    // Validar y enriquecer resultado
    return {
      ...parsedResult,
      processing_info: {
        model_used: 'claude-3-5-sonnet-20241022',
        processing_time: new Date().toISOString(),
        config: config,
        response_length: analysisText.length
      }
    };

  } catch (error) {
    console.error('❌ Error en Claude Vision:', error);
    
    // Errores específicos para mejor debugging
    if (error.message.includes('API key')) {
      throw new Error('API key de Claude no está configurada');
    }
    
    if (error.message.includes('rate_limit')) {
      throw new Error('Límite de API alcanzado, intente en unos minutos');
    }
    
    if (error.message.includes('overloaded')) {
      throw new Error('Servicio Claude temporalmente sobrecargado');
    }
    
    throw new Error(`Error en análisis con Claude Vision: ${error.message}`);
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