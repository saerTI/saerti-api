// Script para generar datos dummy de ingresos y egresos
import { pool } from '../src/config/database.mjs';

const ORGANIZATION_ID = 'test';

// Datos dummy para tipos de ingresos
const incomeTypes = [
  { name: 'Ventas', description: 'Ingresos por ventas de productos', icon: 'shopping-cart', color: '#10B981' },
  { name: 'Servicios', description: 'Ingresos por servicios prestados', icon: 'briefcase', color: '#3B82F6' },
  { name: 'Inversiones', description: 'Retornos de inversiones', icon: 'trending-up', color: '#8B5CF6' },
  { name: 'Alquileres', description: 'Ingresos por arriendos', icon: 'home', color: '#F59E0B' },
  { name: 'Comisiones', description: 'Comisiones ganadas', icon: 'percent', color: '#EC4899' },
  { name: 'Intereses', description: 'Intereses bancarios', icon: 'dollar-sign', color: '#14B8A6' },
  { name: 'Donaciones', description: 'Donaciones recibidas', icon: 'gift', color: '#F97316' },
  { name: 'Otros Ingresos', description: 'Otros ingresos diversos', icon: 'plus-circle', color: '#6366F1' }
];

// Datos dummy para categorías de ingresos
const incomeCategories = [
  { name: 'Productos', description: 'Venta de productos físicos', type: 'Ventas' },
  { name: 'Servicios Digitales', description: 'Servicios en línea', type: 'Servicios' },
  { name: 'Consultoría', description: 'Servicios de consultoría', type: 'Servicios' },
  { name: 'Acciones', description: 'Dividendos de acciones', type: 'Inversiones' },
  { name: 'Bonos', description: 'Retornos de bonos', type: 'Inversiones' },
  { name: 'Local Comercial', description: 'Arriendo de locales', type: 'Alquileres' },
  { name: 'Vivienda', description: 'Arriendo de propiedades', type: 'Alquileres' },
  { name: 'Comisiones Ventas', description: 'Comisiones por ventas', type: 'Comisiones' },
  { name: 'Intereses Bancarios', description: 'Intereses de cuentas', type: 'Intereses' },
  { name: 'Diversos', description: 'Ingresos varios', type: 'Otros Ingresos' }
];

// Datos dummy para estados de ingresos
const incomeStatuses = [
  { name: 'Pendiente', description: 'Ingreso pendiente de confirmación', color: '#F59E0B' },
  { name: 'Confirmado', description: 'Ingreso confirmado', color: '#10B981' },
  { name: 'En Proceso', description: 'Ingreso en proceso de pago', color: '#3B82F6' },
  { name: 'Pagado', description: 'Ingreso pagado completamente', color: '#059669' },
  { name: 'Cancelado', description: 'Ingreso cancelado', color: '#EF4444' }
];

// Datos dummy para tipos de egresos
const expenseTypes = [
  { name: 'Operaciones', description: 'Gastos operacionales', icon: 'settings', color: '#EF4444' },
  { name: 'Personal', description: 'Gastos de personal', icon: 'users', color: '#F59E0B' },
  { name: 'Administración', description: 'Gastos administrativos', icon: 'clipboard', color: '#8B5CF6' },
  { name: 'Marketing', description: 'Gastos de marketing', icon: 'megaphone', color: '#EC4899' },
  { name: 'Tecnología', description: 'Gastos en tecnología', icon: 'cpu', color: '#3B82F6' },
  { name: 'Impuestos', description: 'Pagos de impuestos', icon: 'file-text', color: '#DC2626' },
  { name: 'Servicios', description: 'Servicios contratados', icon: 'zap', color: '#14B8A6' },
  { name: 'Mantenimiento', description: 'Gastos de mantenimiento', icon: 'tool', color: '#F97316' },
  { name: 'Viajes', description: 'Gastos de viajes', icon: 'plane', color: '#6366F1' },
  { name: 'Otros Gastos', description: 'Otros gastos diversos', icon: 'more-horizontal', color: '#64748B' }
];

// Datos dummy para categorías de egresos
const expenseCategories = [
  { name: 'Materiales', description: 'Compra de materiales', type: 'Operaciones' },
  { name: 'Suministros', description: 'Suministros de oficina', type: 'Operaciones' },
  { name: 'Sueldos', description: 'Sueldos y salarios', type: 'Personal' },
  { name: 'Bonos', description: 'Bonos y gratificaciones', type: 'Personal' },
  { name: 'Alquiler', description: 'Arriendo de oficinas', type: 'Administración' },
  { name: 'Servicios Básicos', description: 'Agua, luz, internet', type: 'Administración' },
  { name: 'Publicidad', description: 'Campañas publicitarias', type: 'Marketing' },
  { name: 'Software', description: 'Licencias de software', type: 'Tecnología' },
  { name: 'Hardware', description: 'Equipos computacionales', type: 'Tecnología' },
  { name: 'IVA', description: 'Impuesto al valor agregado', type: 'Impuestos' },
  { name: 'Renta', description: 'Impuesto a la renta', type: 'Impuestos' },
  { name: 'Limpieza', description: 'Servicios de limpieza', type: 'Servicios' },
  { name: 'Reparaciones', description: 'Reparaciones varias', type: 'Mantenimiento' },
  { name: 'Hospedaje', description: 'Hoteles y alojamiento', type: 'Viajes' },
  { name: 'Transporte', description: 'Transporte y movilización', type: 'Viajes' }
];

// Datos dummy para estados de egresos
const expenseStatuses = [
  { name: 'Por Pagar', description: 'Egreso pendiente de pago', color: '#F59E0B' },
  { name: 'Aprobado', description: 'Egreso aprobado', color: '#3B82F6' },
  { name: 'Pagado', description: 'Egreso pagado completamente', color: '#10B981' },
  { name: 'Rechazado', description: 'Egreso rechazado', color: '#EF4444' },
  { name: 'En Revisión', description: 'Egreso en revisión', color: '#8B5CF6' }
];

// Centros de costo
const costCenters = [
  { name: 'Proyecto Alpha', code: 'PRJ-001', description: 'Proyecto de construcción Alpha' },
  { name: 'Proyecto Beta', code: 'PRJ-002', description: 'Proyecto de construcción Beta' },
  { name: 'Oficina Central', code: 'OFC-001', description: 'Oficina administrativa central' },
  { name: 'Bodega Principal', code: 'BOD-001', description: 'Bodega de materiales' },
  { name: 'Departamento TI', code: 'TI-001', description: 'Departamento de tecnología' }
];

// Función para generar fecha aleatoria en los últimos 12 meses
function randomDate() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString()
    .split('T')[0];
}

// Función para generar monto aleatorio
function randomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Función para seleccionar elemento aleatorio
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function seedData() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Iniciando seed de datos dummy...\n');

    // ==========================================
    // 1. CREAR CENTROS DE COSTO
    // ==========================================
    console.log('📍 Creando centros de costo...');
    const costCenterIds = [];

    for (const cc of costCenters) {
      const [result] = await conn.query(
        `INSERT INTO cost_centers (organization_id, name, code, description, type, status, active)
         VALUES (?, ?, ?, ?, 'proyecto', 'activo', true)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, cc.name, cc.code, cc.description]
      );
      costCenterIds.push(result.insertId);
      console.log(`  ✓ ${cc.name} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 2. CREAR TIPOS DE INGRESOS
    // ==========================================
    console.log('\n💰 Creando tipos de ingresos...');
    const incomeTypeIds = {};

    for (const type of incomeTypes) {
      const [result] = await conn.query(
        `INSERT INTO income_types (organization_id, name, description, icon, color,
         show_amount, show_category, show_payment_date, show_reference_number, is_active)
         VALUES (?, ?, ?, ?, ?, true, true, true, true, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, type.name, type.description, type.icon, type.color]
      );
      incomeTypeIds[type.name] = result.insertId;
      console.log(`  ✓ ${type.name} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 3. CREAR CATEGORÍAS DE INGRESOS
    // ==========================================
    console.log('\n🏷️  Creando categorías de ingresos...');
    const incomeCategoryIds = [];

    for (const category of incomeCategories) {
      const typeId = incomeTypeIds[category.type];
      const [result] = await conn.query(
        `INSERT INTO income_categories (organization_id, income_type_id, name, description, is_active)
         VALUES (?, ?, ?, ?, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, typeId, category.name, category.description]
      );
      incomeCategoryIds.push(result.insertId);
      console.log(`  ✓ ${category.name} → ${category.type} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 4. CREAR ESTADOS DE INGRESOS
    // ==========================================
    console.log('\n📊 Creando estados de ingresos...');
    const incomeStatusIds = [];

    for (const status of incomeStatuses) {
      const [result] = await conn.query(
        `INSERT INTO income_statuses (organization_id, name, description, color, is_active)
         VALUES (?, ?, ?, ?, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, status.name, status.description, status.color]
      );
      incomeStatusIds.push(result.insertId);
      console.log(`  ✓ ${status.name} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 5. CREAR TIPOS DE EGRESOS
    // ==========================================
    console.log('\n💸 Creando tipos de egresos...');
    const expenseTypeIds = {};

    for (const type of expenseTypes) {
      const [result] = await conn.query(
        `INSERT INTO expense_types (organization_id, name, description, icon, color,
         show_amount, show_category, show_payment_date, show_reference_number, is_active)
         VALUES (?, ?, ?, ?, ?, true, true, true, true, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, type.name, type.description, type.icon, type.color]
      );
      expenseTypeIds[type.name] = result.insertId;
      console.log(`  ✓ ${type.name} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 6. CREAR CATEGORÍAS DE EGRESOS
    // ==========================================
    console.log('\n🏷️  Creando categorías de egresos...');
    const expenseCategoryIds = [];

    for (const category of expenseCategories) {
      const typeId = expenseTypeIds[category.type];
      const [result] = await conn.query(
        `INSERT INTO expense_categories (organization_id, expense_type_id, name, description, is_active)
         VALUES (?, ?, ?, ?, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, typeId, category.name, category.description]
      );
      expenseCategoryIds.push(result.insertId);
      console.log(`  ✓ ${category.name} → ${category.type} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 7. CREAR ESTADOS DE EGRESOS
    // ==========================================
    console.log('\n📊 Creando estados de egresos...');
    const expenseStatusIds = [];

    for (const status of expenseStatuses) {
      const [result] = await conn.query(
        `INSERT INTO expense_statuses (organization_id, name, description, color, is_active)
         VALUES (?, ?, ?, ?, true) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, status.name, status.description, status.color]
      );
      expenseStatusIds.push(result.insertId);
      console.log(`  ✓ ${status.name} (ID: ${result.insertId})`);
    }

    // ==========================================
    // 8. GENERAR DATOS DE INGRESOS
    // ==========================================
    console.log('\n💵 Generando datos de ingresos (150 registros)...');
    const paymentMethods = ['transferencia', 'cheque', 'efectivo', 'tarjeta'];
    const paymentStatuses = ['pendiente', 'parcial', 'pagado'];

    for (let i = 0; i < 150; i++) {
      const typeId = randomItem(Object.values(incomeTypeIds));
      const statusId = randomItem(incomeStatusIds);
      const categoryId = randomItem(incomeCategoryIds);
      const costCenterId = randomItem(costCenterIds);
      const date = randomDate();
      const netAmount = randomAmount(50000, 500000);
      const taxAmount = Math.round(netAmount * 0.19); // IVA 19%
      const totalAmount = netAmount + taxAmount;

      await conn.query(
        `INSERT INTO incomes_data
        (organization_id, income_type_id, status_id, category_id, cost_center_id,
         name, description, date, amount, net_amount, tax_amount, total_amount,
         payment_date, reference_number, payment_method, payment_status, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ORGANIZATION_ID,
          typeId,
          statusId,
          categoryId,
          costCenterId,
          `Ingreso #${i + 1}`,
          `Descripción del ingreso ${i + 1}`,
          date,
          totalAmount,
          netAmount,
          taxAmount,
          totalAmount,
          date,
          `REF-ING-${String(i + 1).padStart(5, '0')}`,
          randomItem(paymentMethods),
          randomItem(paymentStatuses),
          'CLP'
        ]
      );

      if ((i + 1) % 30 === 0) {
        console.log(`  ✓ ${i + 1} ingresos generados...`);
      }
    }
    console.log('  ✅ 150 ingresos generados exitosamente');

    // ==========================================
    // 9. GENERAR DATOS DE EGRESOS
    // ==========================================
    console.log('\n💳 Generando datos de egresos (150 registros)...');

    for (let i = 0; i < 150; i++) {
      const typeId = randomItem(Object.values(expenseTypeIds));
      const statusId = randomItem(expenseStatusIds);
      const categoryId = randomItem(expenseCategoryIds);
      const costCenterId = randomItem(costCenterIds);
      const date = randomDate();
      const netAmount = randomAmount(30000, 400000);
      const taxAmount = Math.round(netAmount * 0.19); // IVA 19%
      const totalAmount = netAmount + taxAmount;

      await conn.query(
        `INSERT INTO expenses_data
        (organization_id, expense_type_id, status_id, category_id, cost_center_id,
         name, description, date, amount, net_amount, tax_amount, total_amount,
         payment_date, reference_number, payment_method, payment_status, currency, invoice_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ORGANIZATION_ID,
          typeId,
          statusId,
          categoryId,
          costCenterId,
          `Egreso #${i + 1}`,
          `Descripción del egreso ${i + 1}`,
          date,
          totalAmount,
          netAmount,
          taxAmount,
          totalAmount,
          date,
          `REF-EGR-${String(i + 1).padStart(5, '0')}`,
          randomItem(paymentMethods),
          randomItem(paymentStatuses),
          'CLP',
          `FAC-${String(i + 1).padStart(6, '0')}`
        ]
      );

      if ((i + 1) % 30 === 0) {
        console.log(`  ✓ ${i + 1} egresos generados...`);
      }
    }
    console.log('  ✅ 150 egresos generados exitosamente');

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log('\n✨ ¡Seed completado exitosamente!\n');
    console.log('📊 Resumen de datos generados:');
    console.log('  • Centros de Costo:', costCenters.length);
    console.log('  • Tipos de Ingresos:', incomeTypes.length);
    console.log('  • Categorías de Ingresos:', incomeCategories.length);
    console.log('  • Estados de Ingresos:', incomeStatuses.length);
    console.log('  • Tipos de Egresos:', expenseTypes.length);
    console.log('  • Categorías de Egresos:', expenseCategories.length);
    console.log('  • Estados de Egresos:', expenseStatuses.length);
    console.log('  • Registros de Ingresos: 150');
    console.log('  • Registros de Egresos: 150');
    console.log('\n  Organization ID:', ORGANIZATION_ID);

  } catch (error) {
    console.error('\n❌ Error durante el seed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

// Ejecutar seed
seedData()
  .then(() => {
    console.log('\n🎉 Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
