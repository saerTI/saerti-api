// Script completo para generar datos dummy de ingresos y egresos
import { pool } from '../src/config/database.mjs';
import readline from 'readline';

// Función para pedir input al usuario
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Obtener organization_id de los argumentos de línea de comandos o preguntar
let ORGANIZATION_ID = process.argv[2];

if (!ORGANIZATION_ID) {
  console.log('🏢 Seed de datos dummy para SAER\n');
  console.log('Este script generará datos de ejemplo para una organización.');
  console.log('Necesitas proporcionar el ID de la organización.\n');

  ORGANIZATION_ID = await askQuestion('Ingresa el Organization ID: ');

  if (!ORGANIZATION_ID || !ORGANIZATION_ID.trim()) {
    console.error('\n❌ Error: El organization_id no puede estar vacío');
    process.exit(1);
  }

  ORGANIZATION_ID = ORGANIZATION_ID.trim();
  console.log(`\n✅ Usando organization_id: ${ORGANIZATION_ID}\n`);
}

// Configuración de tipos de ingresos con sus categorías y estados
const incomeTypesConfig = [
  {
    name: 'Ventas',
    description: 'Ingresos por ventas de productos',
    icon: 'shopping-cart',
    color: '#10B981',
    categories: [
      { name: 'Productos Físicos', description: 'Venta de productos tangibles' },
      { name: 'Productos Digitales', description: 'Venta de productos digitales' },
      { name: 'Merchandising', description: 'Venta de mercancía' }
    ],
    statuses: [
      { name: 'Cotización', description: 'Venta en cotización', color: '#F59E0B', is_final: false },
      { name: 'Confirmada', description: 'Venta confirmada', color: '#3B82F6', is_final: false },
      { name: 'Pagada', description: 'Venta pagada', color: '#10B981', is_final: true },
      { name: 'Cancelada', description: 'Venta cancelada', color: '#EF4444', is_final: true }
    ]
  },
  {
    name: 'Servicios',
    description: 'Ingresos por servicios prestados',
    icon: 'briefcase',
    color: '#3B82F6',
    categories: [
      { name: 'Consultoría', description: 'Servicios de consultoría' },
      { name: 'Desarrollo', description: 'Desarrollo de software' },
      { name: 'Soporte', description: 'Soporte técnico' },
      { name: 'Capacitación', description: 'Cursos y capacitaciones' }
    ],
    statuses: [
      { name: 'Propuesta', description: 'Propuesta enviada', color: '#F59E0B', is_final: false },
      { name: 'En Progreso', description: 'Servicio en ejecución', color: '#3B82F6', is_final: false },
      { name: 'Completado', description: 'Servicio completado', color: '#10B981', is_final: false },
      { name: 'Facturado', description: 'Servicio facturado', color: '#059669', is_final: true }
    ]
  },
  {
    name: 'Inversiones',
    description: 'Retornos de inversiones',
    icon: 'trending-up',
    color: '#8B5CF6',
    categories: [
      { name: 'Dividendos', description: 'Dividendos de acciones' },
      { name: 'Intereses', description: 'Intereses de bonos' },
      { name: 'Ganancias de Capital', description: 'Ganancias por venta de activos' }
    ],
    statuses: [
      { name: 'Pendiente', description: 'Pago pendiente', color: '#F59E0B', is_final: false },
      { name: 'Recibido', description: 'Pago recibido', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Alquileres',
    description: 'Ingresos por arriendos',
    icon: 'home',
    color: '#F59E0B',
    categories: [
      { name: 'Local Comercial', description: 'Arriendo de locales' },
      { name: 'Vivienda', description: 'Arriendo de propiedades' },
      { name: 'Maquinaria', description: 'Arriendo de equipos' }
    ],
    statuses: [
      { name: 'Pendiente', description: 'Pago mensual pendiente', color: '#F59E0B', is_final: false },
      { name: 'Pagado', description: 'Pago recibido', color: '#10B981', is_final: true },
      { name: 'Vencido', description: 'Pago vencido', color: '#EF4444', is_final: false }
    ]
  },
  {
    name: 'Otros Ingresos',
    description: 'Otros ingresos diversos',
    icon: 'plus-circle',
    color: '#6366F1',
    categories: [
      { name: 'Comisiones', description: 'Comisiones ganadas' },
      { name: 'Donaciones', description: 'Donaciones recibidas' },
      { name: 'Reembolsos', description: 'Reembolsos y devoluciones' }
    ],
    statuses: [
      { name: 'Pendiente', description: 'Por recibir', color: '#F59E0B', is_final: false },
      { name: 'Recibido', description: 'Recibido', color: '#10B981', is_final: true }
    ]
  }
];

// Configuración de tipos de egresos con sus categorías y estados
const expenseTypesConfig = [
  {
    name: 'Operaciones',
    description: 'Gastos operacionales',
    icon: 'settings',
    color: '#EF4444',
    categories: [
      { name: 'Materiales', description: 'Compra de materiales' },
      { name: 'Suministros', description: 'Suministros de oficina' },
      { name: 'Herramientas', description: 'Herramientas y equipos menores' }
    ],
    statuses: [
      { name: 'Solicitado', description: 'Compra solicitada', color: '#F59E0B', is_final: false },
      { name: 'Aprobado', description: 'Compra aprobada', color: '#3B82F6', is_final: false },
      { name: 'Pagado', description: 'Pago realizado', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Personal',
    description: 'Gastos de personal',
    icon: 'users',
    color: '#F59E0B',
    categories: [
      { name: 'Sueldos', description: 'Sueldos y salarios' },
      { name: 'Bonos', description: 'Bonos y gratificaciones' },
      { name: 'Cargas Sociales', description: 'Imposiciones y beneficios' },
      { name: 'Capacitación', description: 'Formación de personal' }
    ],
    statuses: [
      { name: 'Programado', description: 'Pago programado', color: '#3B82F6', is_final: false },
      { name: 'Procesado', description: 'Nómina procesada', color: '#F59E0B', is_final: false },
      { name: 'Pagado', description: 'Pagado', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Administración',
    description: 'Gastos administrativos',
    icon: 'clipboard',
    color: '#8B5CF6',
    categories: [
      { name: 'Alquiler', description: 'Arriendo de oficinas' },
      { name: 'Servicios Básicos', description: 'Agua, luz, internet' },
      { name: 'Seguros', description: 'Pólizas de seguros' },
      { name: 'Mantenimiento', description: 'Mantenimiento de instalaciones' }
    ],
    statuses: [
      { name: 'Por Pagar', description: 'Factura recibida', color: '#F59E0B', is_final: false },
      { name: 'Pagado', description: 'Pago realizado', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Marketing',
    description: 'Gastos de marketing',
    icon: 'megaphone',
    color: '#EC4899',
    categories: [
      { name: 'Publicidad Digital', description: 'Campañas online' },
      { name: 'Publicidad Tradicional', description: 'Medios tradicionales' },
      { name: 'Eventos', description: 'Ferias y eventos' },
      { name: 'Material Promocional', description: 'Folletos, banners, etc.' }
    ],
    statuses: [
      { name: 'Planificado', description: 'Campaña planificada', color: '#3B82F6', is_final: false },
      { name: 'En Ejecución', description: 'Campaña activa', color: '#F59E0B', is_final: false },
      { name: 'Completado', description: 'Campaña finalizada y pagada', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Tecnología',
    description: 'Gastos en tecnología',
    icon: 'cpu',
    color: '#3B82F6',
    categories: [
      { name: 'Software', description: 'Licencias de software' },
      { name: 'Hardware', description: 'Equipos computacionales' },
      { name: 'Cloud/Hosting', description: 'Servicios en la nube' },
      { name: 'Soporte TI', description: 'Soporte técnico' }
    ],
    statuses: [
      { name: 'Cotización', description: 'En cotización', color: '#F59E0B', is_final: false },
      { name: 'Aprobado', description: 'Compra aprobada', color: '#3B82F6', is_final: false },
      { name: 'Pagado', description: 'Pago realizado', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Impuestos',
    description: 'Pagos de impuestos',
    icon: 'file-text',
    color: '#DC2626',
    categories: [
      { name: 'IVA', description: 'Impuesto al valor agregado' },
      { name: 'Renta', description: 'Impuesto a la renta' },
      { name: 'Patente Municipal', description: 'Patentes y permisos' }
    ],
    statuses: [
      { name: 'Por Declarar', description: 'Pendiente de declaración', color: '#F59E0B', is_final: false },
      { name: 'Declarado', description: 'Declarado, pendiente pago', color: '#3B82F6', is_final: false },
      { name: 'Pagado', description: 'Impuesto pagado', color: '#10B981', is_final: true }
    ]
  },
  {
    name: 'Viajes',
    description: 'Gastos de viajes',
    icon: 'plane',
    color: '#6366F1',
    categories: [
      { name: 'Transporte', description: 'Pasajes y combustible' },
      { name: 'Hospedaje', description: 'Hoteles y alojamiento' },
      { name: 'Alimentación', description: 'Comidas durante viajes' },
      { name: 'Otros Gastos', description: 'Gastos varios de viaje' }
    ],
    statuses: [
      { name: 'Solicitado', description: 'Viaje solicitado', color: '#F59E0B', is_final: false },
      { name: 'Aprobado', description: 'Viaje aprobado', color: '#3B82F6', is_final: false },
      { name: 'Rendido', description: 'Gastos rendidos y pagados', color: '#10B981', is_final: true }
    ]
  }
];

// Centros de costo
const costCenters = [
  { name: 'Proyecto Alpha', code: 'PRJ-001', description: 'Proyecto de construcción Alpha' },
  { name: 'Proyecto Beta', code: 'PRJ-002', description: 'Proyecto de construcción Beta' },
  { name: 'Oficina Central', code: 'OFC-001', description: 'Oficina administrativa central' },
  { name: 'Bodega Principal', code: 'BOD-001', description: 'Bodega de materiales' },
  { name: 'Departamento TI', code: 'TI-001', description: 'Departamento de tecnología' }
];

// Funciones auxiliares
function randomDate() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString()
    .split('T')[0];
}

function randomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const paymentMethods = ['transferencia', 'cheque', 'efectivo', 'tarjeta'];
const paymentStatuses = ['pendiente', 'parcial', 'pagado'];

async function seedData() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Iniciando seed completo de datos dummy...\n');

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
    // 2. CREAR TIPOS, CATEGORÍAS Y ESTADOS DE INGRESOS
    // ==========================================
    console.log('\n💰 Creando sistema de ingresos...');
    const incomeTypeMap = {};

    for (const typeConfig of incomeTypesConfig) {
      // Crear tipo
      const [typeResult] = await conn.query(
        `INSERT INTO income_types (organization_id, name, description, icon, color,
         show_amount, show_category, show_payment_date, show_reference_number, is_active)
         VALUES (?, ?, ?, ?, ?, true, true, true, true, true)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, typeConfig.name, typeConfig.description, typeConfig.icon, typeConfig.color]
      );
      const typeId = typeResult.insertId;
      console.log(`  ✓ Tipo: ${typeConfig.name} (ID: ${typeId})`);

      incomeTypeMap[typeConfig.name] = {
        id: typeId,
        categories: [],
        statuses: []
      };

      // Crear categorías para este tipo
      for (const catConfig of typeConfig.categories) {
        const [catResult] = await conn.query(
          `INSERT INTO income_categories (organization_id, income_type_id, name, description, is_active)
           VALUES (?, ?, ?, ?, true)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
          [ORGANIZATION_ID, typeId, catConfig.name, catConfig.description]
        );
        incomeTypeMap[typeConfig.name].categories.push(catResult.insertId);
        console.log(`    • Categoría: ${catConfig.name} (ID: ${catResult.insertId})`);
      }

      // Crear estados para este tipo
      for (const statusConfig of typeConfig.statuses) {
        const [statusResult] = await conn.query(
          `INSERT INTO income_statuses (income_type_id, organization_id, name, description, color, is_final, is_active)
           VALUES (?, ?, ?, ?, ?, ?, true)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
          [typeId, ORGANIZATION_ID, statusConfig.name, statusConfig.description, statusConfig.color, statusConfig.is_final]
        );
        incomeTypeMap[typeConfig.name].statuses.push(statusResult.insertId);
        console.log(`    • Estado: ${statusConfig.name} (ID: ${statusResult.insertId})`);
      }
    }

    // ==========================================
    // 3. CREAR TIPOS, CATEGORÍAS Y ESTADOS DE EGRESOS
    // ==========================================
    console.log('\n💸 Creando sistema de egresos...');
    const expenseTypeMap = {};

    for (const typeConfig of expenseTypesConfig) {
      // Crear tipo
      const [typeResult] = await conn.query(
        `INSERT INTO expense_types (organization_id, name, description, icon, color,
         show_amount, show_category, show_payment_date, show_reference_number, is_active)
         VALUES (?, ?, ?, ?, ?, true, true, true, true, true)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [ORGANIZATION_ID, typeConfig.name, typeConfig.description, typeConfig.icon, typeConfig.color]
      );
      const typeId = typeResult.insertId;
      console.log(`  ✓ Tipo: ${typeConfig.name} (ID: ${typeId})`);

      expenseTypeMap[typeConfig.name] = {
        id: typeId,
        categories: [],
        statuses: []
      };

      // Crear categorías para este tipo
      for (const catConfig of typeConfig.categories) {
        const [catResult] = await conn.query(
          `INSERT INTO expense_categories (organization_id, expense_type_id, name, description, is_active)
           VALUES (?, ?, ?, ?, true)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
          [ORGANIZATION_ID, typeId, catConfig.name, catConfig.description]
        );
        expenseTypeMap[typeConfig.name].categories.push(catResult.insertId);
        console.log(`    • Categoría: ${catConfig.name} (ID: ${catResult.insertId})`);
      }

      // Crear estados para este tipo
      for (const statusConfig of typeConfig.statuses) {
        const [statusResult] = await conn.query(
          `INSERT INTO expense_statuses (expense_type_id, organization_id, name, description, color, is_final, is_active)
           VALUES (?, ?, ?, ?, ?, ?, true)
           ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
          [typeId, ORGANIZATION_ID, statusConfig.name, statusConfig.description, statusConfig.color, statusConfig.is_final]
        );
        expenseTypeMap[typeConfig.name].statuses.push(statusResult.insertId);
        console.log(`    • Estado: ${statusConfig.name} (ID: ${statusResult.insertId})`);
      }
    }

    // ==========================================
    // 4. GENERAR DATOS DE INGRESOS
    // ==========================================
    console.log('\n💵 Generando datos de ingresos...');
    let incomeCount = 0;

    for (const [typeName, typeData] of Object.entries(incomeTypeMap)) {
      const recordsPerType = 30; // 30 registros por tipo
      console.log(`  Generando ${recordsPerType} registros para "${typeName}"...`);

      for (let i = 0; i < recordsPerType; i++) {
        const categoryId = randomItem(typeData.categories);
        const statusId = randomItem(typeData.statuses);
        const costCenterId = randomItem(costCenterIds);
        const date = randomDate();

        // Montos variables según tipo
        let minAmount, maxAmount;
        if (typeName === 'Ventas') {
          minAmount = 100000;
          maxAmount = 2000000;
        } else if (typeName === 'Servicios') {
          minAmount = 200000;
          maxAmount = 3000000;
        } else if (typeName === 'Inversiones') {
          minAmount = 500000;
          maxAmount = 5000000;
        } else if (typeName === 'Alquileres') {
          minAmount = 300000;
          maxAmount = 1500000;
        } else {
          minAmount = 50000;
          maxAmount = 800000;
        }

        const netAmount = randomAmount(minAmount, maxAmount);
        const taxAmount = Math.round(netAmount * 0.19);
        const totalAmount = netAmount + taxAmount;

        await conn.query(
          `INSERT INTO incomes_data
          (organization_id, income_type_id, status_id, category_id, cost_center_id,
           name, description, date, amount, net_amount, tax_amount, total_amount,
           payment_date, reference_number, payment_method, payment_status, currency)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ORGANIZATION_ID,
            typeData.id,
            statusId,
            categoryId,
            costCenterId,
            `${typeName} #${incomeCount + 1}`,
            `Ingreso de ${typeName.toLowerCase()} - ${new Date(date).toLocaleDateString('es-CL')}`,
            date,
            totalAmount,
            netAmount,
            taxAmount,
            totalAmount,
            date,
            `ING-${String(incomeCount + 1).padStart(6, '0')}`,
            randomItem(paymentMethods),
            randomItem(paymentStatuses),
            'CLP'
          ]
        );
        incomeCount++;
      }
      console.log(`  ✓ ${recordsPerType} ingresos de "${typeName}" creados`);
    }
    console.log(`✅ Total: ${incomeCount} ingresos generados`);

    // ==========================================
    // 5. GENERAR DATOS DE EGRESOS
    // ==========================================
    console.log('\n💳 Generando datos de egresos...');
    let expenseCount = 0;

    for (const [typeName, typeData] of Object.entries(expenseTypeMap)) {
      const recordsPerType = 30; // 30 registros por tipo
      console.log(`  Generando ${recordsPerType} registros para "${typeName}"...`);

      for (let i = 0; i < recordsPerType; i++) {
        const categoryId = randomItem(typeData.categories);
        const statusId = randomItem(typeData.statuses);
        const costCenterId = randomItem(costCenterIds);
        const date = randomDate();

        // Montos variables según tipo
        let minAmount, maxAmount;
        if (typeName === 'Personal') {
          minAmount = 500000;
          maxAmount = 3000000;
        } else if (typeName === 'Operaciones') {
          minAmount = 100000;
          maxAmount = 1500000;
        } else if (typeName === 'Administración') {
          minAmount = 200000;
          maxAmount = 1000000;
        } else if (typeName === 'Marketing') {
          minAmount = 150000;
          maxAmount = 2000000;
        } else if (typeName === 'Tecnología') {
          minAmount = 100000;
          maxAmount = 2500000;
        } else if (typeName === 'Impuestos') {
          minAmount = 300000;
          maxAmount = 5000000;
        } else if (typeName === 'Viajes') {
          minAmount = 50000;
          maxAmount = 800000;
        } else {
          minAmount = 50000;
          maxAmount = 500000;
        }

        const netAmount = randomAmount(minAmount, maxAmount);
        const taxAmount = Math.round(netAmount * 0.19);
        const totalAmount = netAmount + taxAmount;

        await conn.query(
          `INSERT INTO expenses_data
          (organization_id, expense_type_id, status_id, category_id, cost_center_id,
           name, description, date, amount, net_amount, tax_amount, total_amount,
           payment_date, reference_number, payment_method, payment_status, currency, invoice_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ORGANIZATION_ID,
            typeData.id,
            statusId,
            categoryId,
            costCenterId,
            `${typeName} #${expenseCount + 1}`,
            `Egreso de ${typeName.toLowerCase()} - ${new Date(date).toLocaleDateString('es-CL')}`,
            date,
            totalAmount,
            netAmount,
            taxAmount,
            totalAmount,
            date,
            `EGR-${String(expenseCount + 1).padStart(6, '0')}`,
            randomItem(paymentMethods),
            randomItem(paymentStatuses),
            'CLP',
            `FAC-${String(expenseCount + 1).padStart(7, '0')}`
          ]
        );
        expenseCount++;
      }
      console.log(`  ✓ ${recordsPerType} egresos de "${typeName}" creados`);
    }
    console.log(`✅ Total: ${expenseCount} egresos generados`);

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log('\n✨ ¡Seed completado exitosamente!\n');
    console.log('📊 Resumen de datos generados:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📍 Centros de Costo:', costCenters.length);
    console.log('\n  💰 INGRESOS:');
    console.log('    • Tipos:', Object.keys(incomeTypeMap).length);
    console.log('    • Categorías:', Object.values(incomeTypeMap).reduce((sum, t) => sum + t.categories.length, 0));
    console.log('    • Estados:', Object.values(incomeTypeMap).reduce((sum, t) => sum + t.statuses.length, 0));
    console.log('    • Registros:', incomeCount);
    console.log('\n  💸 EGRESOS:');
    console.log('    • Tipos:', Object.keys(expenseTypeMap).length);
    console.log('    • Categorías:', Object.values(expenseTypeMap).reduce((sum, t) => sum + t.categories.length, 0));
    console.log('    • Estados:', Object.values(expenseTypeMap).reduce((sum, t) => sum + t.statuses.length, 0));
    console.log('    • Registros:', expenseCount);
    console.log('\n  🏢 Organization ID:', ORGANIZATION_ID);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
