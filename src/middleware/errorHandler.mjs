/**
 * Middleware para manejar errores centralizadamente
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Error por defecto
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error Interno del Servidor';
  
  // Manejar errores de validación
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }
  
  // Manejar errores de clave duplicada
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Entrada duplicada. El recurso ya existe.';
  }
  
  // Manejar errores de restricción de clave foránea
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 400;
    message = 'Violación de restricción de base de datos. El recurso relacionado no existe o no puede ser modificado.';
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

/**
 * Clase personalizada para errores de la aplicación
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}