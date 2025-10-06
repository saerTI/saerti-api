import express from 'express';
import consolidadaController from '../../controllers/CC/consolidadaController.mjs';
import { protect } from '../../middleware/auth.mjs';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(protect);

// ==========================================
// RUTAS PRINCIPALES - VISTA CONSOLIDADA
// ==========================================

// GET /api/consolidada - Obtener vista consolidada con filtros
router.get('/', consolidadaController.getAll);

// GET /api/consolidada/dashboard - Datos para dashboard ejecutivo
router.get('/dashboard', consolidadaController.getDashboard);

// GET /api/consolidada/stats - Estadísticas generales
router.get('/stats', consolidadaController.getStats);

// GET /api/consolidada/proximos-vencer - Registros próximos a vencer
router.get('/proximos-vencer', consolidadaController.getProximosVencer);

// GET /api/consolidada/filter-options - Opciones para filtros
router.get('/filter-options', consolidadaController.getFilterOptions);

// ==========================================
// RUTAS DE RESÚMENES
// ==========================================

// GET /api/consolidada/resumen/estados - Resumen por estado
router.get('/resumen/estados', consolidadaController.getResumenPorEstado);

// GET /api/consolidada/resumen/centros - Resumen por centro de costo
router.get('/resumen/centros', consolidadaController.getResumenPorCentro);

// GET /api/consolidada/resumen/grupos - Resumen por grupo de cuenta
router.get('/resumen/grupos', consolidadaController.getResumenPorGrupoCuenta);

export default router;