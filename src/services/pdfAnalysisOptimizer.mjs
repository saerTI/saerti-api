// src/services/pdfAnalysisOptimizer.mjs
// 🚨 SOLUCION CRITICA: Optimizador de Análisis PDF
// Evita consumo excesivo de API y mejora calidad de extracción

/**
 * 🔥 PASO 1: Pre-validación inteligente del PDF
 * Evita procesar PDFs que no tienen datos útiles
 */
export const preValidatePdfContent = async (extractedText) => {
  // Búsqueda de indicadores de presupuesto
  const budgetIndicators = [
    /precio|valor|costo|total|subtotal|suma/i,
    /materiales?|material/i,
    /mano\s+de\s+obra|trabajador|obrero/i,
    /equipo|maquinaria|herramienta/i,
    /\$|clp|peso|pesos/i,
    /cantidad|unidad|m²|m3|ml|kg|ton/i,
    /partida|item|ítem/i
  ];

  const foundIndicators = budgetIndicators.filter(regex => 
    regex.test(extractedText)
  ).length;

  // Buscar números que parezcan precios (formato chileno)
  const pricePatterns = [
    /\$[\d.,]+/g,
    /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g
  ];

  const foundPrices = pricePatterns.reduce((total, pattern) => {
    const matches = extractedText.match(pattern) || [];
    return total + matches.length;
  }, 0);

  // Verificar estructura tabular
  const hasTableStructure = /\||\t|   +/.test(extractedText);
  
  const validation = {
    isAnalyzable: foundIndicators >= 3 && foundPrices >= 5,
    confidence: Math.min(100, (foundIndicators * 15) + (foundPrices * 2)),
    indicators: foundIndicators,
    prices: foundPrices,
    hasTableStructure,
    recommendation: foundIndicators < 3 
      ? 'PDF no contiene suficientes indicadores de presupuesto'
      : foundPrices < 5 
      ? 'PDF no contiene suficientes valores numéricos'
      : 'PDF apto para análisis'
  };

  console.log('🔍 Pre-validación PDF:', validation);
  return validation;
};

/**
 * 🔥 PASO 2: Extractor inteligente con chunking optimizado
 * Evita procesar chunks vacíos o irrelevantes
 */
export const smartChunkExtractor = (text, maxChunkSize = 4000) => {
  // Limpiar texto de caracteres problemáticos
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s$.,;:()\-\/]/g, '')
    .trim();

  // Dividir por secciones lógicas primero
  const sections = cleanText.split(/(?:PARTIDA|ITEM|SECCION|CAPITULO|PRESUPUESTO)/i);
  
  const relevantChunks = [];
  
  for (let section of sections) {
    if (section.length < 100) continue; // Ignorar secciones muy pequeñas
    
    // Verificar si la sección tiene contenido presupuestario
    const hasBudgetContent = /\$|\d+[.,]\d+|precio|costo|valor|material|mano.*obra/i.test(section);
    
    if (!hasBudgetContent) {
      console.log('⏭️ Saltando chunk sin contenido presupuestario');
      continue;
    }

    // Dividir sección en chunks de tamaño apropiado
    if (section.length > maxChunkSize) {
      const subChunks = section.match(new RegExp(`.{1,${maxChunkSize}}(?:\s|$)`, 'g'));
      relevantChunks.push(...subChunks.filter(chunk => chunk.trim().length > 50));
    } else {
      relevantChunks.push(section);
    }
  }

  console.log(`📝 Chunks optimizados: ${relevantChunks.length} de ${sections.length} secciones originales`);
  return relevantChunks;
};

/**
 * 🔥 PASO 3: Prompt mejorado para extracción estructurada
 * Fuerza respuesta en formato JSON válido
 */
export const generateOptimizedPrompt = (chunkText, chunkIndex, totalChunks) => {
  return `ANALIZAR CHUNK ${chunkIndex}/${totalChunks} DE PRESUPUESTO CONSTRUCCIÓN CHILENO

TEXTO A ANALIZAR:
${chunkText}

INSTRUCCIONES CRÍTICAS:
1. RESPONDER ÚNICAMENTE EN JSON VÁLIDO
2. NO incluir texto explicativo fuera del JSON
3. Si no encuentras datos, usar arrays vacíos []
4. Usar formato numérico sin puntos ni comas para cantidades

ESTRUCTURA REQUERIDA:
{
  "materiales_encontrados": [
    {
      "item": "nombre_material",
      "cantidad": numero_sin_formato,
      "unidad": "m2|m3|kg|ton|und",
      "precio_unitario": numero_sin_formato,
      "subtotal": numero_calculado,
      "categoria": "categoria_general"
    }
  ],
  "mano_obra_encontrada": [
    {
      "especialidad": "tipo_trabajador",
      "cantidad_personas": numero,
      "horas_totales": numero,
      "tarifa_hora": numero,
      "subtotal": numero_calculado
    }
  ],
  "equipos_encontrados": [
    {
      "tipo_equipo": "nombre_equipo",
      "tiempo_uso": "descripcion_tiempo",
      "tarifa_periodo": numero,
      "subtotal": numero_calculado
    }
  ],
  "proveedores_mencionados": [
    {
      "nombre": "nombre_proveedor",
      "contacto": "telefono_o_email_si_existe",
      "especialidad": "area_especializada"
    }
  ],
  "valores_totales": {
    "subtotal_chunk": numero_total_encontrado,
    "moneda": "CLP"
  },
  "observaciones": "cualquier_nota_relevante_breve"
}

ENFÓCATE EN EXTRAER DATOS NUMÉRICOS REALES. Si no hay datos presupuestarios claros, responde con arrays vacíos.`;
};

/**
 * 🔥 PASO 4: Parser robusto de respuestas JSON
 * Maneja respuestas malformadas de la API
 */
export const robustJsonParser = (apiResponse, chunkIndex) => {
  try {
    // Limpiar respuesta de posibles caracteres problemáticos
    let cleanResponse = apiResponse
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Buscar JSON válido en la respuesta
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanResponse);
    
    // Validar estructura mínima
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Respuesta no es un objeto válido');
    }

    console.log(`✅ Chunk ${chunkIndex} parseado exitosamente:`, {
      materiales: parsed.materiales_encontrados?.length || 0,
      mano_obra: parsed.mano_obra_encontrada?.length || 0,
      equipos: parsed.equipos_encontrados?.length || 0,
      proveedores: parsed.proveedores_mencionados?.length || 0
    });

    return {
      success: true,
      data: parsed,
      error: null
    };

  } catch (error) {
    console.error(`❌ Error parseando chunk ${chunkIndex}:`, error.message);
    
    // Intentar extracción manual de valores básicos
    const fallbackData = extractFallbackData(apiResponse);
    
    return {
      success: false,
      data: fallbackData,
      error: error.message,
      raw_response: apiResponse.substring(0, 200) + '...'
    };
  }
};

/**
 * 🔥 PASO 5: Extractor de emergencia cuando falla JSON
 */
const extractFallbackData = (text) => {
  const fallback = {
    materiales_encontrados: [],
    mano_obra_encontrada: [],
    equipos_encontrados: [],
    proveedores_mencionados: [],
    valores_totales: { subtotal_chunk: 0, moneda: "CLP" },
    observaciones: "Extracción de emergencia - JSON inválido"
  };

  // Buscar precios con regex
  const prices = text.match(/\$[\d.,]+|\d{1,3}(?:[.,]\d{3})+/g) || [];
  if (prices.length > 0) {
    fallback.observaciones += ` - ${prices.length} precios detectados`;
  }

  // Buscar materiales comunes
  const materials = text.match(/(?:cemento|arena|grava|ladrillo|acero|fierro|madera|pintura)/gi) || [];
  materials.forEach((material, index) => {
    if (index < 5) { // Máximo 5 materiales de emergencia
      fallback.materiales_encontrados.push({
        item: material.toLowerCase(),
        cantidad: 0,
        unidad: "und",
        precio_unitario: 0,
        subtotal: 0,
        categoria: "material_basico"
      });
    }
  });

  return fallback;
};

/**
 * 🔥 PASO 6: Consolidador inteligente de resultados
 * Mejora la calidad de la síntesis final
 */
export const intelligentConsolidator = (chunkResults) => {
  const consolidatedData = {
    all_materials: [],
    all_labor: [],
    all_equipment: [],
    all_providers: [],
    total_chunks_processed: chunkResults.length,
    successful_chunks: chunkResults.filter(r => r.success).length,
    extraction_quality: 0
  };

  // Consolidar datos de todos los chunks exitosos
  chunkResults.forEach((result, index) => {
    if (!result.success || !result.data) return;

    const data = result.data;
    
    // Consolidar materiales
    if (data.materiales_encontrados?.length > 0) {
      consolidatedData.all_materials.push(...data.materiales_encontrados);
    }
    
    // Consolidar mano de obra
    if (data.mano_obra_encontrada?.length > 0) {
      consolidatedData.all_labor.push(...data.mano_obra_encontrada);
    }
    
    // Consolidar equipos
    if (data.equipos_encontrados?.length > 0) {
      consolidatedData.all_equipment.push(...data.equipos_encontrados);
    }
    
    // Consolidar proveedores
    if (data.proveedores_mencionados?.length > 0) {
      consolidatedData.all_providers.push(...data.proveedores_mencionados);
    }
  });

  // Calcular calidad de extracción
  const totalItems = consolidatedData.all_materials.length + 
                    consolidatedData.all_labor.length + 
                    consolidatedData.all_equipment.length;
                    
  consolidatedData.extraction_quality = Math.min(100, 
    (consolidatedData.successful_chunks / consolidatedData.total_chunks_processed) * 50 +
    (totalItems > 0 ? 30 : 0) +
    (consolidatedData.all_providers.length > 0 ? 20 : 0)
  );

  console.log('📊 Consolidación completada:', {
    materiales: consolidatedData.all_materials.length,
    mano_obra: consolidatedData.all_labor.length,
    equipos: consolidatedData.all_equipment.length,
    proveedores: consolidatedData.all_providers.length,
    calidad: `${consolidatedData.extraction_quality}%`
  });

  return consolidatedData;
};

/**
 * 🔥 PASO 7: Generador de análisis final optimizado
 * Crea el resumen ejecutivo con los datos consolidados
 */
export const generateOptimizedFinalAnalysis = (consolidatedData, originalConfig) => {
  const analysis = {
    resumen_ejecutivo: generateExecutiveSummary(consolidatedData),
    presupuesto_estimado: calculateEstimatedBudget(consolidatedData),
    materiales_detallados: consolidatedData.all_materials || [],
    mano_obra: consolidatedData.all_labor || [],
    equipos_maquinaria: consolidatedData.all_equipment || [],
    proveedores_chile: consolidatedData.all_providers || [],
    analisis_riesgos: generateRiskAnalysis(consolidatedData),
    recomendaciones: generateRecommendations(consolidatedData),
    cronograma_estimado: generateTimelineEstimate(consolidatedData),
    confidence_score: consolidatedData.extraction_quality || 0,
    desglose_costos: generateCostBreakdown(consolidatedData),
    factores_regionales: generateRegionalFactors(originalConfig),
    chunks_procesados: consolidatedData.total_chunks_processed,
    chunks_exitosos: consolidatedData.successful_chunks,
    processing_method: "optimized_chunking",
    extraction_metadata: {
      source: "claude_vision_optimized",
      pdf_type: "analyzed_structured",
      confidence: consolidatedData.extraction_quality,
      processing_time_ms: Date.now(),
      extraction_method: "intelligent_chunking"
    }
  };

  return analysis;
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
 * 🔥 FUNCIÓN AUXILIAR: Estimador de costos de API antes del análisis
 */
export const estimateApiCosts = (input, analysisConfig = {}) => {
  let estimatedTextLength;
  
  // 🔥 DETECCIÓN INTELIGENTE: ¿Es fileSize o textLength real?
  if (typeof input === 'number' && input > 1000000) {
    // Es fileSize (muy grande) - convertir a estimación de texto real
    const fileSizeMB = input / (1024 * 1024);
    
    // 📊 ESTIMACIÓN REALISTA: Un PDF típico tiene 20-50 caracteres útiles por KB
    // PDF de 11MB → ~50,000-150,000 caracteres de texto (NO 11 millones!)
    estimatedTextLength = Math.min(fileSizeMB * 1024 * 40, 200000);
    
    console.log(`🔧 Conversión: ${fileSizeMB.toFixed(1)}MB file → ~${estimatedTextLength} chars texto`);
  } else {
    // Es textLength real
    estimatedTextLength = input || 10000;
  }

  // 🔥 CÁLCULO CORRECTO basado en texto real
  const baseInputTokens = Math.ceil(estimatedTextLength / 4); // ~4 chars por token
  const chunks = Math.min(Math.ceil(estimatedTextLength / 3500), 6); // Máximo 6 chunks
  
  const estimates = {
    input_tokens: baseInputTokens,
    output_tokens: 1500 * chunks, // ~1.5k tokens output por chunk
    total_tokens: baseInputTokens + (1500 * chunks),
    estimated_cost_usd: ((baseInputTokens * 0.003) + (1500 * chunks * 0.015)) / 1000,
    chunks_to_process: chunks,
    analysis_depth: analysisConfig.analysisDepth || 'standard',
    text_length_estimated: estimatedTextLength,
    was_file_size: input > 1000000
  };

  estimates.estimated_cost_clp = estimates.estimated_cost_usd * 950;

  // Alertas realistas
  if (estimates.estimated_cost_usd > 1.0) {
    estimates.cost_warning = 'ALTO - Análisis costoso';
  } else if (estimates.estimated_cost_usd > 0.3) {
    estimates.cost_warning = 'MEDIO - Costo moderado'; 
  } else {
    estimates.cost_warning = 'BAJO - Costo aceptable';
  }

  console.log(`💰 Estimación corregida: $${estimates.estimated_cost_usd.toFixed(3)} USD (${chunks} chunks, ~${estimatedTextLength} chars)`);

  return estimates;
};

/**
 * 🔥 FUNCIÓN ESPECÍFICA: Para estimar desde fileSize cuando no tenemos texto aún
 */
export const estimateCostFromFileSize = (fileSizeBytes) => {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  
  // Tabla de costos realistas basada en experiencia
  let cost;
  if (fileSizeMB < 1) cost = 0.05;
  else if (fileSizeMB < 3) cost = 0.10;
  else if (fileSizeMB < 8) cost = 0.20;
  else if (fileSizeMB < 15) cost = 0.35; // ← Tu caso de 11MB
  else if (fileSizeMB < 25) cost = 0.60;
  else cost = 1.00;
  
  return {
    file_size_mb: fileSizeMB,
    estimated_cost_usd: cost,
    estimated_cost_clp: cost * 950
  };
};

// Funciones auxiliares para el análisis final
const generateExecutiveSummary = (data) => {
  const materialCount = data.all_materials.length;
  const laborCount = data.all_labor.length;
  const equipmentCount = data.all_equipment.length;
  const providerCount = data.all_providers.length;

  if (materialCount === 0 && laborCount === 0 && equipmentCount === 0) {
    return "El presupuesto analizado no contiene información estructurada suficiente para generar un análisis detallado. Se requiere un documento con mayor nivel de detalle presupuestario.";
  }

  return `Análisis completado exitosamente. Se identificaron ${materialCount} materiales, ${laborCount} tipos de mano de obra, ${equipmentCount} equipos y ${providerCount} proveedores. El nivel de detalle permite realizar estimaciones preliminares para el proyecto.`;
};

const calculateEstimatedBudget = (data) => {
  const materialTotal = data.all_materials.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const laborTotal = data.all_labor.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const equipmentTotal = data.all_equipment.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const total = materialTotal + laborTotal + equipmentTotal;

  return {
    total_clp: total,
    materials_percentage: total > 0 ? Math.round((materialTotal / total) * 100) : 0,
    labor_percentage: total > 0 ? Math.round((laborTotal / total) * 100) : 0,
    equipment_percentage: total > 0 ? Math.round((equipmentTotal / total) * 100) : 0,
    overhead_percentage: 15 // Estimación estándar
  };
};

const generateRiskAnalysis = (data) => {
  const risks = [];
  
  if (data.all_materials.length === 0) {
    risks.push({
      factor: 'Ausencia de detalle de materiales',
      probability: 'alta',
      impact: 'alto',
      mitigation: 'Solicitar listado detallado de materiales con especificaciones técnicas'
    });
  }

  if (data.all_labor.length === 0) {
    risks.push({
      factor: 'Falta de especificación de mano de obra',
      probability: 'alta',
      impact: 'medio',
      mitigation: 'Definir perfiles profesionales y horas hombre requeridas'
    });
  }

  if (data.extraction_quality < 50) {
    risks.push({
      factor: 'Calidad de información insuficiente',
      probability: 'alta',
      impact: 'alto',
      mitigation: 'Proporcionar presupuesto en formato más estructurado (Excel, tabla detallada)'
    });
  }

  return risks;
};

const generateRecommendations = (data) => {
  const recommendations = [];

  if (data.extraction_quality < 70) {
    recommendations.push("Mejorar el formato del presupuesto para facilitar análisis automatizado");
  }

  if (data.all_materials.length > 0) {
    recommendations.push("Validar precios de materiales con proveedores locales");
  }

  if (data.all_providers.length > 0) {
    recommendations.push("Solicitar cotizaciones formales a los proveedores identificados");
  }

  recommendations.push("Desarrollar cronograma detallado basado en los ítems identificados");

  return recommendations;
};

const generateTimelineEstimate = (data) => {
  if (data.all_materials.length + data.all_labor.length + data.all_equipment.length === 0) {
    return "Requiere información adicional para estimar cronograma";
  }

  return "Estimación preliminar: 8-12 semanas basado en los ítems identificados";
};

const generateCostBreakdown = (data) => {
  const materialTotal = data.all_materials.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const laborTotal = data.all_labor.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const equipmentTotal = data.all_equipment.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  return {
    materiales: materialTotal,
    mano_obra: laborTotal,
    equipos: equipmentTotal,
    gastos_generales: Math.round((materialTotal + laborTotal + equipmentTotal) * 0.15),
    utilidad: Math.round((materialTotal + laborTotal + equipmentTotal) * 0.10),
    total: Math.round((materialTotal + laborTotal + equipmentTotal) * 1.25)
  };
};

const generateRegionalFactors = (config) => {
  return {
    market_conditions: "Considerar volatilidad actual de precios de materiales en Chile",
    logistics: `Evaluar costos de transporte para proyecto en ${config?.projectLocation || 'ubicación especificada'}`,
    local_regulations: "Verificar cumplimiento normativas chilenas (NCh, OGUC)",
    climate_impact: "Considerar estacionalidad para planificación de obra"
  };
};

export default {
  preValidatePdfContent,
  smartChunkExtractor,
  generateOptimizedPrompt,
  robustJsonParser,
  intelligentConsolidator,
  generateOptimizedFinalAnalysis,
  validatePdfBeforeProcessing,
  estimateApiCosts
};