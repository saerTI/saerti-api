// Crea un archivo: scripts/setupDefaultData.mjs

import { pool } from "../src/config/database.mjs";


/**
 * Script para crear datos por defecto necesarios para el funcionamiento
 */
async function setupDefaultData() {
  try {
    console.log('🚀 Iniciando configuración de datos por defecto...');
    
    // ✅ 1. VERIFICAR/CREAR CENTROS DE COSTO POR DEFECTO
    console.log('📋 Verificando centros de costo...');
    
    const [existingCenters] = await pool.query(
      'SELECT id, code, name FROM cost_centers WHERE code IN (?, ?, ?)',
      ['DEFAULT-001', 'GEN-001', 'ADMIN-001']
    );
    
    console.log(`📊 Centros de costo existentes: ${existingCenters.length}`);
    
    if (existingCenters.length === 0) {
      console.log('📝 Creando centros de costo por defecto...');
      
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
        },
        {
          code: 'ADMIN-001',
          name: 'Administración',
          type: 'administrative', 
          status: 'active',
          description: 'Centro de costos administrativos'
        }
      ];
      
      for (const center of defaultCenters) {
        const [result] = await pool.query(
          `INSERT INTO cost_centers (code, name, type, status, description) 
           VALUES (?, ?, ?, ?, ?)`,
          [center.code, center.name, center.type, center.status, center.description]
        );
        console.log(`✅ Centro de costo creado: ${center.code} (ID: ${result.insertId})`);
      }
    } else {
      console.log('✅ Centros de costo ya existen');
      existingCenters.forEach(center => {
        console.log(`  - ${center.code}: ${center.name} (ID: ${center.id})`);
      });
    }
    
    // ✅ 2. VERIFICAR/CREAR CATEGORÍAS DE CUENTA POR DEFECTO
    console.log('\n📋 Verificando categorías de cuenta...');
    
    const [existingCategories] = await pool.query(
      'SELECT id, name FROM account_categories WHERE name IN (?, ?, ?)',
      ['OTHER GENERAL PROJECT EXPENSES', 'Gastos Generales', 'Otros Gastos']
    );
    
    console.log(`📊 Categorías existentes: ${existingCategories.length}`);
    
    if (existingCategories.length === 0) {
      console.log('📝 Creando categorías por defecto...');
      
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
        },
        {
          name: 'Otros Gastos',
          code: 'OTROS-001', 
          description: 'Categoría para gastos no clasificados'
        }
      ];
      
      for (const category of defaultCategories) {
        const [result] = await pool.query(
          `INSERT INTO account_categories (name, code, description) 
           VALUES (?, ?, ?)`,
          [category.name, category.code, category.description]
        );
        console.log(`✅ Categoría creada: ${category.name} (ID: ${result.insertId})`);
      }
    } else {
      console.log('✅ Categorías ya existen');
      existingCategories.forEach(category => {
        console.log(`  - ${category.name} (ID: ${category.id})`);
      });
    }
    
    // ✅ 3. VERIFICAR ESTRUCTURA DE TABLAS
    console.log('\n📋 Verificando estructura de tablas...');
    
    // Verificar purchase_orders
    const [poColumns] = await pool.query('DESCRIBE purchase_orders');
    const requiredColumns = ['cost_center_id', 'account_category_id', 'supplier_id'];
    
    console.log('📊 Columnas de purchase_orders:');
    poColumns.forEach(col => {
      const isRequired = col.Null === 'NO' && col.Default === null && col.Extra !== 'auto_increment';
      const isNullable = col.Null === 'YES';
      console.log(`  - ${col.Field}: ${col.Type} ${isRequired ? '(REQUIRED)' : isNullable ? '(NULLABLE)' : '(DEFAULT)'}`);
    });
    
    // ✅ 4. CREAR ÍNDICES SI NO EXISTEN
    console.log('\n📋 Verificando índices...');
    
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_po_cost_center 
        ON purchase_orders(cost_center_id)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_po_category 
        ON purchase_orders(account_category_id)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_po_status 
        ON purchase_orders(status)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_po_date 
        ON purchase_orders(po_date)
      `);
      
      console.log('✅ Índices verificados/creados');
    } catch (error) {
      console.warn('⚠️ Error creando índices (pueden ya existir):', error.message);
    }
    
    // ✅ 5. REPORTE FINAL
    console.log('\n📊 RESUMEN FINAL:');
    
    const [finalCenters] = await pool.query('SELECT COUNT(*) as count FROM cost_centers');
    const [finalCategories] = await pool.query('SELECT COUNT(*) as count FROM account_categories'); 
    const [finalOrders] = await pool.query('SELECT COUNT(*) as count FROM purchase_orders');
    
    console.log(`✅ Centros de costo: ${finalCenters[0].count}`);
    console.log(`✅ Categorías de cuenta: ${finalCategories[0].count}`);
    console.log(`✅ Órdenes de compra: ${finalOrders[0].count}`);
    
    console.log('\n🎉 Configuración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en setupDefaultData:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDefaultData()
    .then(() => {
      console.log('✅ Script completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script falló:', error);
      process.exit(1);
    });
}

export { setupDefaultData };