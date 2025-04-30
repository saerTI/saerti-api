import app from './app.mjs';
import config from './src/config/config.mjs';

const PORT = config.server.port;

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`
  ┌───────────────────────────────────────────────┐
  │                                               │
  │           CashFlow API Server                 │
  │                                               │
  └───────────────────────────────────────────────┘

  Servidor ejecutándose en puerto: ${PORT}
  Entorno: ${config.server.env}
  
  Acceda a la API en: http://localhost:${PORT}/api/health
  
  Presione CTRL+C para detener el servidor
  `);
});