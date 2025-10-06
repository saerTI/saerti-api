// src/routes/CC/ordenCompraRoutes.mjs
import { pool } from '../../config/database.mjs';
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.mjs';
import { 
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  createPurchaseOrdersBatch,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus
} from '../../controllers/CC/ordenCompraController.mjs';

const router = Router();


/**
 * @route   GET /api/ordenes-compra/check-constraints
 * @desc    Verificar constraints y estructura de la base de datos
 * @access  Privado (temporal para debugging)  
 */
router.get(
  '/api/ordenes-compra/check-constraints',
  authenticate,
  async (req, res) => {
    try {
      console.log('🔍 Verificando constraints de la base de datos...');
      
      // Verificar estructura de purchase_orders
      const [tableStructure] = await pool.query('DESCRIBE purchase_orders');
      
      // Verificar datos existentes
      const [dataStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(cost_center_id) as orders_with_center,
          COUNT(account_category_id) as orders_with_category,
          COUNT(supplier_id) as orders_with_supplier,
          (SELECT COUNT(*) FROM cost_centers) as total_centers,
          (SELECT COUNT(*) FROM account_categories) as total_categories,
          (SELECT COUNT(*) FROM suppliers) as total_suppliers
        FROM purchase_orders
      `);
      
      const stats = dataStats[0];
      
      // Verificar constraints
      const constraints = {
        cost_center_id: {
          nullable: tableStructure.find(col => col.Field === 'cost_center_id')?.Null === 'YES',
          hasDefault: tableStructure.find(col => col.Field === 'cost_center_id')?.Default !== null,
          ordersWithNull: stats.total_orders - stats.orders_with_center
        },
        account_category_id: {
          nullable: tableStructure.find(col => col.Field === 'account_category_id')?.Null === 'YES',
          hasDefault: tableStructure.find(col => col.Field === 'account_category_id')?.Default !== null,
          ordersWithNull: stats.total_orders - stats.orders_with_category
        },
        supplier_id: {
          nullable: tableStructure.find(col => col.Field === 'supplier_id')?.Null === 'YES',
          hasDefault: tableStructure.find(col => col.Field === 'supplier_id')?.Default !== null,
          ordersWithNull: stats.total_orders - stats.orders_with_supplier
        }
      };
      
      const issues = [];
      
      // Detectar problemas
      Object.entries(constraints).forEach(([field, constraint]) => {
        if (!constraint.nullable && constraint.ordersWithNull > 0) {
          issues.push(`${field} is NOT NULL but ${constraint.ordersWithNull} orders have NULL values`);
        }
      });
      
      if (stats.total_centers === 0) {
        issues.push('No cost centers exist in the database');
      }
      
      if (stats.total_categories === 0) {
        issues.push('No account categories exist in the database');
      }
      
      res.json({
        success: true,
        tableStructure: tableStructure.map(col => ({
          field: col.Field,
          type: col.Type,
          nullable: col.Null === 'YES',
          key: col.Key,
          default: col.Default,
          extra: col.Extra
        })),
        dataStats: stats,
        constraints: constraints,
        issues: issues,
        recommendations: issues.length > 0 ? [
          'Run POST /api/ordenes-compra/fix-database to resolve these issues',
          'Consider making cost_center_id and account_category_id nullable if business logic allows',
          'Ensure default cost centers and categories exist before importing data'
        ] : [
          'Database structure looks good for purchase order operations'
        ]
      });
      
    } catch (error) {
      console.error('❌ Error checking constraints:', error);
      res.status(500).json({
        success: false,
        message: 'Constraint check failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/ordenes-compra/batch
 * @desc    Crear múltiples órdenes de compra en lote
 * @access  Privado
 */
router.post(
  '/api/ordenes-compra/batch',
  authenticate,
  [
    body('*.orderNumber')
      .notEmpty().withMessage('El número de orden es obligatorio')
      .isLength({ min: 1, max: 50 }).withMessage('El número de orden debe tener entre 1 y 50 caracteres'),
    body('*.providerName')
      .notEmpty().withMessage('El nombre del proveedor es obligatorio')
      .isLength({ min: 2, max: 255 }).withMessage('El proveedor debe tener entre 2 y 255 caracteres'),
    body('*.date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('*.state').optional()
      .isIn(['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado']).withMessage('Estado no válido'),
    body('*.categoriaNombre').optional().isString(),
    body('*.centroCosto').optional().isString()
  ],
  createPurchaseOrdersBatch
);

/**
 * @route   POST /api/ordenes-compra
 * @desc    Crear una nueva orden de compra
 * @access  Privado
 */
router.post(
  '/api/ordenes-compra',
  authenticate,
  [
    body('orderNumber')
      .notEmpty().withMessage('El número de orden es obligatorio')
      .isLength({ min: 1, max: 50 }).withMessage('El número de orden debe tener entre 1 y 50 caracteres'),
    body('providerName')
      .notEmpty().withMessage('El nombre del proveedor es obligatorio')
      .isLength({ min: 2, max: 255 }).withMessage('El proveedor debe tener entre 2 y 255 caracteres'),
    body('date').optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    body('state').optional()
      .isIn(['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado']).withMessage('Estado no válido'),
    body('categoriaNombre').optional().isString(),
    body('centroCosto').optional().isString(),
    body('description').optional().isLength({ max: 500 })
  ],
  createPurchaseOrder
);

/**
 * @route   GET /api/ordenes-compra
 * @desc    Obtener lista de órdenes de compra con filtros y paginación
 * @access  Privado
 */
router.get(
  '/api/ordenes-compra',
  authenticate,
  getPurchaseOrders
);

/**
 * @route   GET /api/ordenes-compra/:id
 * @desc    Obtener una orden de compra por ID
 * @access  Privado
 */
router.get(
  '/api/ordenes-compra/:id',
  authenticate,
  getPurchaseOrderById
);

/**
 * @route   PUT /api/ordenes-compra/:id
 * @desc    Actualizar una orden de compra
 * @access  Privado
 */
router.put(
  '/api/ordenes-compra/:id',
  authenticate,
  [
    body('orderNumber').optional().isLength({ min: 1, max: 50 }),
    body('providerName').optional().isLength({ min: 2, max: 255 }),
    body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    body('state').optional().isIn(['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado']),
    body('categoriaNombre').optional().isString(),
    body('centroCosto').optional().isString(),
    body('description').optional().isLength({ max: 500 })
  ],
  updatePurchaseOrder
);

/**
 * @route   PUT /api/ordenes-compra/:id/state
 * @desc    Actualizar solo el estado de una orden de compra
 * @access  Privado
 */
router.put(
  '/api/ordenes-compra/:id/state',
  authenticate,
  [
    body('state')
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado']).withMessage('Estado no válido')
  ],
  updatePurchaseOrderStatus
);

/**
 * @route   DELETE /api/ordenes-compra/:id
 * @desc    Eliminar una orden de compra
 * @access  Privado
 */
router.delete(
  '/api/ordenes-compra/:id',
  authenticate,
  deletePurchaseOrder
);












/**
 * @route   POST /api/ordenes-compra/fix-database
 * @desc    Arreglar problemas de base de datos y crear datos por defecto
 * @access  Privado (temporal para debugging)
 */
router.post(
  '/api/ordenes-compra/fix-database',
  authenticate,
  async (req, res) => {
    try {
      console.log('🔧 Iniciando reparación de base de datos...');
      
      const results = {
        timestamp: new Date().toISOString(),
        actions: [],
        errors: [],
        summary: {
          centersCreated: 0,
          categoriesCreated: 0,
          indexesCreated: 0,
          ordersFixed: 0
        }
      };
      
      // ✅ 1. CREAR CENTROS DE COSTO POR DEFECTO
      try {
        console.log('📋 Verificando centros de costo...');
        
        const [existingCenters] = await pool.query(
          'SELECT id, code, name FROM cost_centers WHERE code IN (?, ?, ?)',
          ['DEFAULT-001', 'GEN-001', 'ADMIN-001']
        );
        
        if (existingCenters.length === 0) {
          const defaultCenters = [
            {
              code: 'DEFAULT-001',
              name: 'Centro de Costo General',
              type: 'administrative',
              status: 'active',
              description: 'Centro de costo por defecto para órdenes de compra'
            },
            {
              code: 'GEN-001', 
              name: 'Gastos Generales',
              type: 'administrative',
              status: 'active',
              description: 'Centro para gastos administrativos generales'
            }
          ];
          
          for (const center of defaultCenters) {
            const [result] = await pool.query(
              `INSERT INTO cost_centers (code, name, type, status, description) 
               VALUES (?, ?, ?, ?, ?)`,
              [center.code, center.name, center.type, center.status, center.description]
            );
            
            results.actions.push(`Centro de costo creado: ${center.code} (ID: ${result.insertId})`);
            results.summary.centersCreated++;
          }
        } else {
          results.actions.push(`Centros de costo ya existen: ${existingCenters.length}`);
        }
      } catch (error) {
        results.errors.push(`Error creando centros de costo: ${error.message}`);
      }
      
      // ✅ 2. CREAR CATEGORÍAS POR DEFECTO
      try {
        console.log('📋 Verificando categorías...');
        
        const [existingCategories] = await pool.query(
          'SELECT id, name FROM account_categories WHERE name IN (?, ?, ?)',
          ['OTHER GENERAL PROJECT EXPENSES', 'Gastos Generales', 'Otros Gastos']
        );
        
        if (existingCategories.length === 0) {
          const defaultCategories = [
            {
              name: 'OTHER GENERAL PROJECT EXPENSES',
              code: 'OTHER-001',
              description: 'Categoría por defecto para gastos generales del proyecto'
            },
            {
              name: 'Gastos Generales',
              code: 'GEN-001',
              description: 'Gastos administrativos y generales'
            }
          ];
          
          for (const category of defaultCategories) {
            const [result] = await pool.query(
              `INSERT INTO account_categories (name, code, description) 
               VALUES (?, ?, ?)`,
              [category.name, category.code, category.description]
            );
            
            results.actions.push(`Categoría creada: ${category.name} (ID: ${result.insertId})`);
            results.summary.categoriesCreated++;
          }
        } else {
          results.actions.push(`Categorías ya existen: ${existingCategories.length}`);
        }
      } catch (error) {
        results.errors.push(`Error creando categorías: ${error.message}`);
      }
      
      // ✅ 3. ARREGLAR ÓRDENES CON cost_center_id NULL
      try {
        console.log('🔧 Arreglando órdenes con cost_center_id NULL...');
        
        // Obtener el primer centro de costo disponible
        const [defaultCenter] = await pool.query(
          'SELECT id FROM cost_centers WHERE status = ? ORDER BY id ASC LIMIT 1',
          ['active']
        );
        
        if (defaultCenter.length > 0) {
          const defaultCenterId = defaultCenter[0].id;
          
          // Actualizar órdenes con cost_center_id NULL
          const [updateResult] = await pool.query(
            'UPDATE purchase_orders SET cost_center_id = ? WHERE cost_center_id IS NULL',
            [defaultCenterId]
          );
          
          if (updateResult.affectedRows > 0) {
            results.actions.push(`Arregladas ${updateResult.affectedRows} órdenes con cost_center_id NULL`);
            results.summary.ordersFixed = updateResult.affectedRows;
          }
        }
      } catch (error) {
        results.errors.push(`Error arreglando órdenes: ${error.message}`);
      }
      
      // ✅ 4. CREAR ÍNDICES
      try {
        const indexes = [
          'CREATE INDEX IF NOT EXISTS idx_po_cost_center ON purchase_orders(cost_center_id)',
          'CREATE INDEX IF NOT EXISTS idx_po_category ON purchase_orders(account_category_id)',
          'CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)',
          'CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(po_date)'
        ];
        
        for (const indexSql of indexes) {
          await pool.query(indexSql);
          results.summary.indexesCreated++;
        }
        
        results.actions.push('Índices verificados/creados');
      } catch (error) {
        results.errors.push(`Error creando índices: ${error.message}`);
      }
      
      // ✅ 5. ESTADÍSTICAS FINALES
      const [finalStats] = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM cost_centers) as total_centers,
          (SELECT COUNT(*) FROM account_categories) as total_categories,
          (SELECT COUNT(*) FROM purchase_orders) as total_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE cost_center_id IS NULL) as orders_with_null_center
      `);
      
      const stats = finalStats[0];
      
      res.json({
        success: true,
        message: 'Database repair completed',
        results: results,
        finalStats: {
          totalCenters: stats.total_centers,
          totalCategories: stats.total_categories,
          totalOrders: stats.total_orders,
          ordersWithNullCenter: stats.orders_with_null_center
        },
        recommendation: stats.orders_with_null_center > 0 ? 
          'Some orders still have NULL cost_center_id. Please run this endpoint again.' :
          'Database is now in good condition for purchase order creation.'
      });
      
    } catch (error) {
      console.error('❌ Error in database repair:', error);
      res.status(500).json({
        success: false,
        message: 'Database repair failed',
        error: error.message
      });
    }
  }
);



export default router;