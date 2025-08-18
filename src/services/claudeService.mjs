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