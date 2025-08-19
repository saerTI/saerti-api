// src/services/pdfExtractionService.mjs
// 🔥 VERSIÓN LIMPIA - SOLO FUNCIONES UTILIZADAS
import config from '../config/config.mjs';
import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 🔥 USAR CONFIG CORRECTO
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

let pdfParse;

// Solo cargar pdf-parse (que funciona bien en Linux)
try {
  const pdfModule = await import('pdf-parse');
  pdfParse = pdfModule.default;
  console.log('✅ pdf-parse cargado correctamente');
} catch (error) {
  console.warn('⚠️ pdf-parse no disponible:', error.message);
  pdfParse = null;
}

console.log('🐧 Modo Linux: Usando herramientas del sistema para conversión PDF');

export class PdfExtractionService {
  
  /**
   * 🔥 FUNCIÓN PRINCIPAL - ÚNICA FUNCIÓN PÚBLICA NECESARIA
   */
  static async extractContent(buffer, fileName) {
    try {
      console.log(`📝 Iniciando extracción para: ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      const startTime = Date.now();
      
      // Análisis de tipo de PDF
      const analysis = await this.analyzePdfType(buffer);
      console.log(`🔍 PDF clasificado como: ${analysis.pdfType} (${analysis.textLength} caracteres)`);
      
      // 🔥 ESTRATEGIA PRINCIPAL: CLAUDE VISION DIRECTO PARA PDFs LARGOS
      if (buffer.length < 30 * 1024 * 1024) { // < 30MB
        console.log('🎯 ESTRATEGIA: Análisis directo con Claude Vision (PDF completo)');
        try {
          return await this.analyzeWithClaudeVisionDirect(buffer, fileName, analysis, startTime);
        } catch (visionError) {
          console.warn('⚠️ Claude Vision directo falló, intentando estrategia de chunks:', visionError.message);
        }
      }
      
      // Fallback: Estrategia por páginas para PDFs muy grandes
      console.log('📄 ESTRATEGIA: Análisis por páginas (PDF muy grande)');
      return await this.analyzeByPages(buffer, fileName, analysis, startTime);
      
    } catch (error) {
      console.error('❌ Error en extractContent:', error);
      throw error;
    }
  }

  /**
   * 🔥 ANÁLISIS DIRECTO CON CLAUDE VISION PARA PDFs COMPLETOS
   */
  static async analyzeWithClaudeVisionDirect(buffer, fileName, analysis, startTime) {
    try {
      console.log('🤖 Analizando PDF completo con Claude Vision...');
      
      // Convertir PDF a base64
      const base64Pdf = buffer.toString('base64');
      
      const prompt = `
Analiza este documento PDF completo de construcción/presupuesto y extrae TODO el contenido.

RESPONDER EN FORMATO JSON:
{
  "extracted_text": "TEXTO COMPLETO DEL DOCUMENTO PRESERVANDO ESTRUCTURA",
  "budget_summary": {
    "total_budget_clp": número,
    "project_name": "nombre del proyecto",
    "contractor": "empresa contratista",
    "document_type": "presupuesto|cotizacion|especificacion"
  },
  "detailed_items": [
    {
      "item": "descripción del item",
      "cantidad": número,
      "unidad": "m2/m3/kg/unidad",
      "precio_unitario": número,
      "subtotal": número,
      "categoria": "materiales|mano_obra|equipos|otros",
      "seccion": "sección del presupuesto"
    }
  ],
  "totals_by_section": {
    "materiales": número,
    "mano_obra": número,
    "equipos": número,
    "gastos_generales": número,
    "iva": número,
    "total_final": número
  },
  "key_observations": [
    "observación importante 1",
    "observación importante 2"
  ],
  "confidence_score": número_entre_80_y_100
}

INSTRUCCIONES CRÍTICAS:
1. Extrae TODOS los ítems con precios del documento
2. Mantén la estructura y formato original del texto
3. Identifica correctamente monedas (CLP, UF, USD)
4. Calcula totales cuando no estén explícitos
5. Preserva números con máxima precisión

DOCUMENTO: ${fileName}
`;

      const response = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: config.anthropic.maxTokens,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf
              }
            }
          ]
        }]
      });

      const analysisText = response.content[0].text;
      console.log(`✅ Claude Vision analizó PDF completo (${analysisText.length} caracteres)`);

      // Parsear respuesta JSON
      let parsedResult;
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
          
          // Validar que se extrajo contenido útil
          if (parsedResult.extracted_text && parsedResult.extracted_text.length > 100) {
            console.log(`📊 Extracción exitosa: ${parsedResult.detailed_items?.length || 0} items detectados`);
            
            return {
              content: parsedResult.extracted_text,
              extraction_method: 'claude_vision_direct_pdf',
              success: true,
              confidence: parsedResult.confidence_score || 85,
              processing_time_ms: Date.now() - startTime,
              pdf_type: 'analyzed_complete',
              source: 'claude_vision_direct',
              metadata: parsedResult,
              items_extracted: parsedResult.detailed_items?.length || 0
            };
          }
        }
        
        throw new Error('JSON inválido o contenido insuficiente');
        
      } catch (parseError) {
        console.warn('⚠️ Error parseando JSON, usando texto directo');
        
        // Si hay texto extraído aunque no sea JSON, usarlo
        if (analysisText.length > 500) {
          return {
            content: analysisText,
            extraction_method: 'claude_vision_text_fallback',
            success: true,
            confidence: 75,
            processing_time_ms: Date.now() - startTime,
            pdf_type: 'analyzed_text_only',
            source: 'claude_vision_fallback',
            note: 'Análisis completo pero formato no estructurado'
          };
        }
        
        throw parseError;
      }
      
    } catch (error) {
      console.error('❌ Error en análisis Claude Vision directo:', error);
      throw error;
    }
  }

  /**
   * 🔥 ANÁLISIS POR PÁGINAS PARA PDFs MUY GRANDES
   */
  static async analyzeByPages(buffer, fileName, analysis, startTime) {
    try {
      console.log('📚 Analizando PDF por páginas...');
      
      // Convertir a imágenes página por página
      const images = await this.convertToImagesByPages(buffer, fileName);
      
      if (!images || images.length === 0) {
        throw new Error('No se pudieron generar imágenes del PDF');
      }
      
      console.log(`📄 ${images.length} páginas convertidas a imágenes`);
      
      // Analizar en batches de 5 páginas
      const batchSize = 5;
      const allResults = [];
      let consolidatedText = '';
      
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        console.log(`📊 Analizando batch ${Math.floor(i/batchSize) + 1}: páginas ${i + 1}-${Math.min(i + batchSize, images.length)}`);
        
        try {
          const batchResult = await this.analyzeBatchWithClaude(batch, i + 1, images.length);
          allResults.push(batchResult);
          
          if (batchResult.extracted_text) {
            consolidatedText += `\n\n--- PÁGINAS ${i + 1}-${Math.min(i + batchSize, images.length)} ---\n`;
            consolidatedText += batchResult.extracted_text;
          }
          
          // Pausa para evitar rate limiting
          if (i + batchSize < images.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (batchError) {
          console.warn(`⚠️ Error en batch ${Math.floor(i/batchSize) + 1}:`, batchError.message);
          allResults.push({ error: batchError.message, pages: `${i + 1}-${Math.min(i + batchSize, images.length)}` });
        }
      }
      
      // Consolidar resultados
      const successfulBatches = allResults.filter(r => !r.error).length;
      const totalBatches = allResults.length;
      
      console.log(`✅ Análisis por páginas completado: ${successfulBatches}/${totalBatches} batches exitosos`);
      
      return {
        content: consolidatedText,
        extraction_method: 'claude_vision_paginated',
        success: true,
        confidence: Math.round((successfulBatches / totalBatches) * 85),
        processing_time_ms: Date.now() - startTime,
        pdf_type: 'paginated_analysis',
        source: 'claude_vision_batched',
        pages_processed: images.length,
        batches_processed: totalBatches,
        successful_batches: successfulBatches,
        detailed_results: allResults
      };
      
    } catch (error) {
      console.error('❌ Error en análisis por páginas:', error);
      throw error;
    }
  }

  /**
   * CONVIERTE PDF A IMÁGENES POR PÁGINAS
   */
  static async convertToImagesByPages(buffer, fileName) {
    try {
      const tempId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempPdfPath = `./temp/${tempId}.pdf`;
      const tempImagePrefix = `./temp/${tempId}`;
      
      // Asegurar que existe directorio temp
      await fs.mkdir('./temp', { recursive: true });
      
      try {
        // Guardar PDF temporal
        await fs.writeFile(tempPdfPath, buffer);
        console.log(`💾 PDF guardado temporalmente: ${tempPdfPath}`);
        
        // Verificar herramientas disponibles
        try {
          await execAsync('which pdftoppm');
        } catch (e) {
          throw new Error('pdftoppm no disponible. Instale: sudo dnf install poppler-utils');
        }
        
        // Convertir TODAS las páginas a imágenes
        const command = `pdftoppm -png -r 150 "${tempPdfPath}" "${tempImagePrefix}"`;
        console.log('🔄 Convirtiendo todas las páginas:', command);
        
        await execAsync(command);
        
        // Buscar todas las imágenes generadas
        const tempDir = './temp';
        const files = await fs.readdir(tempDir);
        const imageFiles = files.filter(file => 
          file.startsWith(path.basename(tempImagePrefix)) && file.endsWith('.png')
        ).sort();
        
        console.log(`📸 ${imageFiles.length} páginas convertidas`);
        
        if (imageFiles.length === 0) {
          throw new Error('No se generaron imágenes del PDF');
        }
        
        // Convertir a formato para Claude
        const images = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const imagePath = path.join(tempDir, imageFiles[i]);
          try {
            const imageBuffer = await fs.readFile(imagePath);
            
            images.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBuffer.toString('base64')
              }
            });
            
            console.log(`✅ Página ${i + 1} preparada (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            
            // Limpiar imagen temporal
            await fs.unlink(imagePath).catch(() => {});
            
          } catch (imageError) {
            console.warn(`⚠️ Error procesando página ${i + 1}:`, imageError.message);
          }
        }
        
        return images;
        
      } finally {
        // Limpiar archivo PDF temporal
        await fs.unlink(tempPdfPath).catch(() => {});
      }
      
    } catch (error) {
      console.error('❌ Error convirtiendo PDF a imágenes:', error);
      throw error;
    }
  }

  /**
   * ANALIZA UN BATCH DE PÁGINAS CON CLAUDE
   */
  static async analyzeBatchWithClaude(images, startPage, totalPages) {
    try {
      const prompt = `
Extrae TODO el texto de estas ${images.length} páginas de un presupuesto de construcción.

PÁGINAS: ${startPage} a ${startPage + images.length - 1} de ${totalPages}

RESPONDER EN JSON:
{
  "extracted_text": "TEXTO COMPLETO DE ESTAS PÁGINAS",
  "budget_items": [
    {
      "item": "descripción",
      "cantidad": número,
      "unidad": "unidad",
      "precio_unitario": número,
      "subtotal": número,
      "pagina": número_de_página
    }
  ],
  "section_totals": {
    "subtotal_seccion": número,
    "seccion_name": "nombre de la sección"
  },
  "page_notes": ["observaciones importantes de estas páginas"]
}

CRÍTICO: Extrae TODOS los números, precios y cantidades con máxima precisión.
`;

      const response = await anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images
          ]
        }]
      });

      const analysisText = response.content[0].text;
      
      // Intentar parsear JSON
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            pages_in_batch: images.length,
            start_page: startPage
          };
        }
      } catch (parseError) {
        console.warn(`⚠️ Error parseando JSON del batch ${startPage}, usando texto`);
      }
      
      // Fallback: retornar texto sin estructura
      return {
        extracted_text: analysisText,
        pages_in_batch: images.length,
        start_page: startPage,
        parsing_error: true
      };
      
    } catch (error) {
      console.error('❌ Error analizando batch:', error);
      throw error;
    }
  }

  /**
   * ANALIZA TIPO DE PDF
   */
  static async analyzePdfType(buffer) {
    let textLength = 0;
    let extractedText = '';
    let extractionError = null;
    
    try {
      if (pdfParse) {
        console.log('📖 Analizando PDF con pdf-parse...');
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text?.trim() || '';
        textLength = extractedText.length;
        console.log(`📊 Texto extraído: ${textLength} caracteres`);
      } else {
        extractionError = 'pdf-parse no disponible';
      }
    } catch (error) {
      console.warn('⚠️ Error en pdf-parse:', error.message);
      extractionError = error.message;
    }
    
    return {
      textLength,
      hasText: textLength > 0,
      hasRichText: textLength > 500,
      isScanned: textLength < 50,
      extractedText,
      extractionError,
      pdfType: textLength > 500 ? 'native_text' :
               textLength > 50 ? 'hybrid' : 'scanned'
    };
  }
}