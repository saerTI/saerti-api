// src/services/pdfExtractionService.mjs
// 🐧 VERSIÓN COMPATIBLE CON LINUX - SIN PDF2PIC

import Anthropic from '@anthropic-ai/sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
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

// NO cargar pdf2pic ya que causa problemas en Linux
console.log('🐧 Modo Linux: Usando herramientas del sistema para conversión PDF');

export class PdfExtractionService {
  
  /**
   * Función principal compatible con Linux
   */
  static async extractContent(buffer, fileName) {
    try {
      console.log(`📝 Iniciando extracción Linux-compatible de: ${fileName}`);
      const startTime = Date.now();
      
      // Análisis de tipo de PDF
      const analysis = await this.analyzePdfType(buffer);
      console.log(`🔍 PDF clasificado como: ${analysis.pdfType} (${analysis.textLength} caracteres)`);
      
      // Estrategia basada en análisis
      if (analysis.hasRichText) {
        console.log('📝 ESTRATEGIA: PDF con texto nativo');
        return await this.processNativeText(analysis, startTime);
      } else if (analysis.isScanned) {
        console.log('🖼️ ESTRATEGIA: PDF escaneado (OCR con herramientas Linux)');
        return await this.processScannedLinux(buffer, fileName, analysis, startTime);
      } else {
        console.log('🔄 ESTRATEGIA: PDF híbrido');
        return await this.processHybridLinux(buffer, fileName, analysis, startTime);
      }
    } catch (error) {
      console.error('❌ Error en extractContent:', error);
      throw error;
    }
  }

  /**
   * Analiza tipo de PDF
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

  /**
   * Procesa PDF con texto nativo
   */
  static async processNativeText(analysis, startTime) {
    return {
      content: analysis.extractedText,
      extraction_method: 'pdf_text_native',
      success: true,
      confidence: 95,
      processing_time_ms: Date.now() - startTime,
      pdf_type: 'native_text',
      source: 'pdf_parse_library'
    };
  }

  /**
   * Procesa PDF escaneado usando herramientas Linux nativas
   */
  static async processScannedLinux(buffer, fileName, analysis, startTime) {
    console.log('🐧 Procesando PDF escaneado con herramientas Linux...');
    
    try {
      // Estrategia 1: Usar pdftoppm (parte de poppler-utils)
      const images = await this.convertWithPdftoppm(buffer);
      
      if (images && images.length > 0) {
        console.log(`✅ ${images.length} imágenes generadas con pdftoppm`);
        
        const ocrResult = await this.performOCR(images, {
          document_type: 'scanned_construction_budget'
        });
        
        return {
          content: ocrResult.extracted_text,
          extraction_method: 'pdftoppm_claude_vision',
          success: true,
          confidence: ocrResult.confidence || 88,
          processing_time_ms: Date.now() - startTime,
          images_processed: images.length,
          pdf_type: 'scanned',
          source: 'linux_native_tools'
        };
      }
      
      throw new Error('No se pudieron generar imágenes');
      
    } catch (error) {
      console.warn('⚠️ Conversión con herramientas Linux falló:', error.message);
      
      // Fallback: Claude directo (si el PDF no es muy grande)
      if (buffer.length < 10 * 1024 * 1024) { // < 10MB
        try {
          console.log('🧪 Intentando Claude Vision directo...');
          return await this.tryClaudeDirectPdf(buffer, analysis, startTime);
        } catch (directError) {
          console.warn('⚠️ Claude directo falló:', directError.message);
        }
      }
      
      // Último fallback
      if (analysis.hasText && analysis.textLength > 10) {
        console.log('🔄 FALLBACK: Usando texto parcial');
        return {
          content: analysis.extractedText,
          extraction_method: 'pdf_text_fallback',
          success: true,
          confidence: 30,
          processing_time_ms: Date.now() - startTime,
          pdf_type: 'scanned_with_fallback',
          warning: 'Conversión a imágenes falló, usando texto parcial'
        };
      }
      
      throw new Error(
        'No se pudo procesar el PDF escaneado.\n\n' +
        'SOLUCIONES PARA LINUX:\n' +
        '1. Instalar poppler-utils: sudo dnf install poppler-utils\n' +
        '2. Verificar ImageMagick: sudo dnf install ImageMagick\n' +
        '3. Convertir PDF externamente a JPG/PNG\n' +
        '4. Usar un OCR online primero'
      );
    }
  }

  /**
   * Convierte PDF usando pdftoppm (herramienta Linux nativa)
   */
  static async convertWithPdftoppm(buffer) {
    try {
      console.log('🔄 Convirtiendo PDF con pdftoppm...');
      
      // Crear directorio temporal
      await fs.mkdir('./temp', { recursive: true });
      
      const tempId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const tempPdfPath = `./temp/${tempId}.pdf`;
      const tempImagePrefix = `./temp/${tempId}`;
      
      try {
        // Guardar PDF temporal
        await fs.writeFile(tempPdfPath, buffer);
        console.log('📄 PDF temporal guardado');
        
        // Verificar si pdftoppm está disponible
        try {
          await execAsync('which pdftoppm');
        } catch (error) {
          throw new Error('pdftoppm no encontrado. Instale poppler-utils: sudo dnf install poppler-utils');
        }
        
        // Convertir PDF a imágenes PNG con pdftoppm
        const command = `pdftoppm -png -f 1 -l 8 -r 200 "${tempPdfPath}" "${tempImagePrefix}"`;
        console.log('🔄 Ejecutando:', command);
        
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stderr.includes('Warning')) {
          console.warn('⚠️ pdftoppm stderr:', stderr);
        }
        
        // Buscar archivos PNG generados
        const tempDir = './temp';
        const files = await fs.readdir(tempDir);
        const imageFiles = files.filter(file => 
          file.startsWith(tempId) && file.endsWith('.png')
        ).sort();
        
        console.log(`📸 Archivos de imagen encontrados: ${imageFiles.length}`);
        
        if (imageFiles.length === 0) {
          throw new Error('pdftoppm no generó archivos de imagen');
        }
        
        // Convertir archivos a base64
        const images = [];
        for (let i = 0; i < Math.min(imageFiles.length, 8); i++) {
          const imagePath = path.join(tempDir, imageFiles[i]);
          try {
            const imageBuffer = await fs.readFile(imagePath);
            
            images.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBuffer.toString('base64')
              },
              page_number: i + 1,
              size_mb: (imageBuffer.length / 1024 / 1024).toFixed(2)
            });
            
            console.log(`✅ Página ${i + 1} convertida (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            
            // Limpiar archivo temporal
            await fs.unlink(imagePath).catch(() => {});
            
          } catch (imageError) {
            console.warn(`⚠️ Error procesando imagen ${imageFiles[i]}:`, imageError.message);
          }
        }
        
        return images;
        
      } finally {
        // Limpiar archivo PDF temporal
        await fs.unlink(tempPdfPath).catch(() => {});
      }
      
    } catch (error) {
      console.error('❌ Error en convertWithPdftoppm:', error);
      throw error;
    }
  }

  /**
   * Intenta usar Claude Vision directamente con el PDF
   */
  static async tryClaudeDirectPdf(buffer, analysis, startTime) {
    console.log('🧪 Intentando análisis directo con Claude...');
    
    const base64Pdf = buffer.toString('base64');
    
    // Solo intentar si el PDF no es muy grande
    if (base64Pdf.length > 15 * 1024 * 1024) {
      throw new Error('PDF demasiado grande para análisis directo');
    }
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `
Analiza este documento PDF escaneado y extrae todo el texto visible.

IMPORTANTE:
- Es un presupuesto o especificaciones técnicas de construcción
- Extrae números, cantidades, precios con máxima precisión
- Mantén el formato y estructura original
- Si hay tablas, preserva columnas y filas

Responde SOLO con el texto extraído, sin comentarios adicionales.

[PDF BASE64: ${base64Pdf.substring(0, 100)}...]`
      }]
    });
    
    const extractedText = response.content[0].text;
    
    if (!extractedText || extractedText.length < 50) {
      throw new Error('Claude no pudo extraer texto suficiente');
    }
    
    return {
      content: extractedText,
      extraction_method: 'claude_direct_pdf',
      success: true,
      confidence: 75,
      processing_time_ms: Date.now() - startTime,
      pdf_type: 'scanned',
      source: 'claude_direct_analysis',
      note: 'Análisis experimental directo con Claude'
    };
  }

  /**
   * Procesa PDF híbrido
   */
  static async processHybridLinux(buffer, fileName, analysis, startTime) {
    try {
      const images = await this.convertWithPdftoppm(buffer);
      
      if (images && images.length > 0) {
        const ocrResult = await this.performOCR(images.slice(0, 5), {
          document_type: 'hybrid_construction_document'
        });
        
        const combinedText = this.combineTextSources(
          analysis.extractedText, 
          ocrResult.extracted_text
        );
        
        return {
          content: combinedText,
          extraction_method: 'hybrid_pdftoppm_claude',
          success: true,
          confidence: Math.min(85, ocrResult.confidence || 80),
          processing_time_ms: Date.now() - startTime,
          pdf_type: 'hybrid'
        };
      }
    } catch (error) {
      console.warn('⚠️ OCR híbrido falló:', error.message);
    }
    
    // Fallback a solo texto
    return {
      content: analysis.extractedText,
      extraction_method: 'pdf_text_only',
      success: true,
      confidence: 70,
      processing_time_ms: Date.now() - startTime,
      pdf_type: 'hybrid_text_only',
      warning: 'OCR no disponible, usando solo texto extraído'
    };
  }

  /**
   * OCR con Claude Vision
   */
  static async performOCR(images, config = {}) {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('API key de Anthropic no configurada');
      }

      console.log(`📤 Enviando ${images.length} imágenes a Claude Vision...`);

      const prompt = `
Extrae TODO el texto visible de estas imágenes de un presupuesto de construcción chileno.

RESPONDER EN JSON:
{
  "extracted_text": "TEXTO COMPLETO PRESERVANDO FORMATO",
  "confidence": número_entre_70_y_100,
  "document_structure": {
    "has_tables": true/false,
    "has_totals": true/false,
    "format_type": "budget|specs|quote|other"
  }
}

Maximiza precisión en números y cantidades.
`;

      const messageContent = [
        { type: 'text', text: prompt },
        ...images.slice(0, 8)
      ];

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        temperature: 0.1,
        messages: [{ role: 'user', content: messageContent }]
      });

      const analysisText = response.content[0].text;
      
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          console.log(`✅ OCR exitoso: ${result.extracted_text?.length || 0} caracteres`);
          return result;
        } else {
          throw new Error('No JSON válido');
        }
      } catch (parseError) {
        return {
          extracted_text: analysisText,
          confidence: 75,
          document_structure: { format_type: 'unknown' },
          parsing_error: true
        };
      }

    } catch (error) {
      console.error('❌ Error en performOCR:', error);
      throw new Error(`Error en OCR: ${error.message}`);
    }
  }

  /**
   * Combina texto de múltiples fuentes
   */
  static combineTextSources(originalText, ocrText) {
    if (!originalText) return ocrText || '';
    if (!ocrText) return originalText;
    
    return ocrText + '\n\n--- TEXTO ADICIONAL ---\n' + originalText;
  }

  /**
   * Diagnóstico específico para Linux
   */
  static async diagnoseLinux() {
    console.log('🐧 Diagnóstico Linux...');
    
    const tools = {
      pdftoppm: false,
      imagemagick: false,
      ghostscript: false
    };
    
    try {
      await execAsync('which pdftoppm');
      tools.pdftoppm = true;
      console.log('✅ pdftoppm disponible');
    } catch {
      console.warn('❌ pdftoppm no encontrado');
    }
    
    try {
      await execAsync('which convert');
      tools.imagemagick = true;
      console.log('✅ ImageMagick disponible');
    } catch {
      console.warn('❌ ImageMagick no encontrado');
    }
    
    try {
      await execAsync('which gs');
      tools.ghostscript = true;
      console.log('✅ Ghostscript disponible');
    } catch {
      console.warn('❌ Ghostscript no encontrado');
    }
    
    return {
      pdf_parse: !!pdfParse,
      anthropic_key: !!process.env.ANTHROPIC_API_KEY,
      platform: process.platform,
      tools,
      recommended_install: !tools.pdftoppm ? 'sudo dnf install poppler-utils' : null
    };
  }
}