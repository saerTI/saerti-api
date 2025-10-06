// app.mjs
import express from 'express';
import cors from 'cors';
import { testConnection } from './src/config/database.mjs';
import { errorHandler } from './src/middleware/errorHandler.mjs';

// ============================================
// IMPORTAR CLERK AUTH (nuevo)
// ============================================
import { clerkAuth } from './src/middleware/clerkAuth.mjs';

// Importar rutas (mantener todas como están)
import authRoutes from './src/routes/authRoutes.mjs';
import userRoutes from './src/routes/userRoutes.mjs';
import projectRoutes from './src/routes/projectRoutes.mjs';
import milestoneRoutes from './src/routes/milestoneRoutes.mjs';
import cashFlowRoutes from './src/routes/cashFlowRoutes.mjs';
import reportRoutes from './src/routes/reportRoutes.mjs';
import previsionalRoutes from './src/routes/CC/previsionalRoutes.mjs';
import remuneracionRoutes from './src/routes/CC/remuneracionRoutes.mjs';
import ordenCompraRoutes from './src/routes/CC/ordenCompraRoutes.mjs';
import ordenCompraItemRoutes from './src/routes/CC/OrdenCompraItemRoutes.mjs';
import multidimensionalRoutes from './src/routes/CC/multidimensionalRoutes.mjs';
import fixedCostsRoutes from './src/routes/CC/fixedCostsRoutes.mjs';
import empleadosRoutes from './src/routes/CC/empleadosRoutes.mjs';
import incomeRoutes from './src/routes/incomeRoutes.mjs';
import incomeCategoriesRoutes from './src/routes/incomeCategoriesRoutes.mjs';
import factoringRoutes from './src/routes/factoringRoutes.mjs';
import factoringEntityRoutes from './src/routes/factoringEntityRoutes.mjs';
import accountCategoryRoutes from './src/routes/accountCategoryRoutes.mjs';
import budgetSuggestionsRoutes from './src/routes/budgetSuggestionsRoutes.mjs';

const app = express();

// Verificar conexión a la base de datos
testConnection()
  .then(connected => {
    if (!connected) {
      console.error('❌ No se pudo conectar a la base de datos.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Error al verificar la conexión:', err);
    process.exit(1);
  });

// ============================================
// MIDDLEWARE BÁSICO
// ============================================

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] ⚠️ Origen bloqueado: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger mejorado
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const org = req.headers['x-organization-id'] ? `[Org: ${req.headers['x-organization-id']}]` : '';
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} ${org}`);
  next();
});

// ============================================
// RUTAS PÚBLICAS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'SAERTI API funcionando correctamente',
    timestamp: new Date(),
    version: '2.0.0-clerk',
    auth: 'Clerk Multi-Tenant Enabled',
    database: 'Connected'
  });
});

// ============================================
// APLICAR CLERK AUTH GLOBALMENTE
// ============================================

// Skip auth para login/register legacy (temporal)
app.use((req, res, next) => {
  // Rutas públicas que no requieren auth
  const publicPaths = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/register'
  ];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Aplicar clerkAuth a todo lo demás
  return clerkAuth(req, res, next);
});

// ============================================
// RUTAS (ahora todas protegidas por clerkAuth)
// ============================================

app.use(authRoutes);
app.use(userRoutes);
app.use(projectRoutes);
app.use(milestoneRoutes);
app.use(cashFlowRoutes);
app.use(reportRoutes);
app.use(previsionalRoutes);
app.use(remuneracionRoutes);
app.use(ordenCompraRoutes);
app.use(ordenCompraItemRoutes);
app.use(multidimensionalRoutes);
app.use(fixedCostsRoutes);
app.use(empleadosRoutes);
app.use(incomeRoutes);
app.use('/api/income-categories', incomeCategoriesRoutes);
app.use(factoringRoutes);
app.use(factoringEntityRoutes);
app.use('/api/account-categories', accountCategoryRoutes);
app.use(budgetSuggestionsRoutes);

// ============================================
// ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

app.use(errorHandler);

export default app;