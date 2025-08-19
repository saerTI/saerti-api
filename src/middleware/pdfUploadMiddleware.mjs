// src/middleware/pdfUploadMiddleware.mjs
import multer from 'multer';
import path from 'path';

/**
 * Configuración de multer para upload de PDFs
 */
const pdfUpload = multer({
  // Usar memoria storage para evitar guardar archivos en disco
  storage: multer.memoryStorage(),
  
  // Límites del archivo
  limits: {
    fileSize: 30 * 1024 * 1024, // 15MB máximo
    files: 1 // Solo un archivo por request
  },
  
  // Filtro de archivos
  fileFilter: (req, file, cb) => {
    console.log('📁 Validando archivo:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    // Verificar que sea un PDF por mimetype
    if (file.mimetype !== 'application/pdf') {
      console.warn('❌ Archivo rechazado - No es PDF:', file.mimetype);
      return cb(new Error('Solo se permiten archivos PDF'), false);
    }

    // Verificar extensión del archivo
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (fileExtension !== '.pdf') {
      console.warn('❌ Archivo rechazado - Extensión incorrecta:', fileExtension);
      return cb(new Error('Solo se permiten archivos con extensión .pdf'), false);
    }

    console.log('✅ Archivo PDF válido aceptado');
    cb(null, true);
  }
});

/**
 * Middleware para manejar errores de multer
 */
export const handlePdfUploadErrors = (error, req, res, next) => {
  console.error('❌ Error en upload de PDF:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: 'Archivo demasiado grande. Máximo 15MB permitido',
          error_code: 'FILE_TOO_LARGE',
          timestamp: new Date().toISOString()
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Solo se permite un archivo por vez',
          error_code: 'TOO_MANY_FILES',
          timestamp: new Date().toISOString()
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Campo de archivo inesperado. Use "pdfFile"',
          error_code: 'UNEXPECTED_FIELD',
          timestamp: new Date().toISOString()
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Error en carga de archivo',
          error_code: 'UPLOAD_ERROR',
          details: error.message,
          timestamp: new Date().toISOString()
        });
    }
  }

  // Error de filtro personalizado
  if (error.message.includes('PDF') || error.message.includes('pdf')) {
    return res.status(415).json({
      success: false,
      message: error.message,
      error_code: 'INVALID_FILE_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico
  return res.status(500).json({
    success: false,
    message: 'Error interno en carga de archivo',
    error_code: 'INTERNAL_UPLOAD_ERROR',
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware específico para análisis de PDF
 * Campo esperado: 'pdfFile'
 */
export const uploadPdfForAnalysis = pdfUpload.single('pdfFile');

/**
 * Middleware para validar que se recibió un archivo
 */
export const validatePdfPresence = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se recibió archivo PDF. Asegúrese de enviar el archivo en el campo "pdfFile"',
      error_code: 'NO_FILE_RECEIVED',
      timestamp: new Date().toISOString()
    });
  }

  console.log('✅ Archivo PDF recibido correctamente:', {
    originalname: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype
  });

  next();
};

export default {
  uploadPdfForAnalysis,
  handlePdfUploadErrors,
  validatePdfPresence
};