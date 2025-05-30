import express from 'express';
import cors from 'cors';
import { testConnection } from './src/config/database.mjs';
import { errorHandler } from './src/middleware/errorHandler.mjs';

// Importar rutas
import authRoutes from './src/routes/authRoutes.mjs';
import projectRoutes from './src/routes/projectRoutes.mjs';
import milestoneRoutes from './src/routes/milestoneRoutes.mjs';
import cashFlowRoutes from './src/routes/cashFlowRoutes.mjs';
import reportRoutes from './src/routes/reportRoutes.mjs';
import previsionalRoutes from './src/routes/CC/previsionalRoutes.mjs';
import remuneracionRoutes from './src/routes/CC/remuneracionRoutes.mjs';

// Inicializar aplicación de Express
const app = express();

// Verificar conexión a la base de datos
testConnection()
  .then(connected => {
    if (!connected) {
      console.error('No se pudo conectar a la base de datos. Verifique la configuración.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Error al verificar la conexión a la base de datos:', err);
    process.exit(1);
  });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para registrar solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Rutas
app.use(authRoutes);
app.use(projectRoutes);
app.use(milestoneRoutes);
app.use(cashFlowRoutes);
app.use(reportRoutes);
app.use(previsionalRoutes);
app.use(remuneracionRoutes);

// Ruta de prueba para verificar que la API está funcionando
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'ConstructFlow API está funcionando correctamente',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// Middleware para manejar rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware para manejar errores
app.use(errorHandler);

export default app;