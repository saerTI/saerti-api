// Script para agregar columnas de montos a incomes_data y expenses_data
import { pool } from '../src/config/database.mjs';

async function addAmountColumns() {
  const conn = await pool.getConnection();

  try {
    console.log('🔧 Agregando columnas de montos a las tablas...');

    // Agregar columnas a incomes_data
    console.log('\n📝 Agregando columnas a incomes_data...');

    // Verificar si las columnas ya existen
    const [incomeColumns] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'incomes_data'
      AND COLUMN_NAME IN ('tax_amount', 'net_amount', 'total_amount')
    `);

    if (incomeColumns.length === 0) {
      await conn.query(`
        ALTER TABLE incomes_data
        ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto de impuestos/IVA' AFTER reference_number,
        ADD COLUMN net_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto neto sin impuestos' AFTER tax_amount,
        ADD COLUMN total_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto total con impuestos' AFTER net_amount
      `);
      console.log('✅ Columnas agregadas a incomes_data');
    } else {
      console.log('ℹ️  Las columnas ya existen en incomes_data');
    }

    // Agregar columnas a expenses_data
    console.log('\n📝 Agregando columnas a expenses_data...');

    const [expenseColumns] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'expenses_data'
      AND COLUMN_NAME IN ('tax_amount', 'net_amount', 'total_amount')
    `);

    if (expenseColumns.length === 0) {
      await conn.query(`
        ALTER TABLE expenses_data
        ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto de impuestos/IVA' AFTER reference_number,
        ADD COLUMN net_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto neto sin impuestos' AFTER tax_amount,
        ADD COLUMN total_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Monto total con impuestos' AFTER net_amount
      `);
      console.log('✅ Columnas agregadas a expenses_data');
    } else {
      console.log('ℹ️  Las columnas ya existen en expenses_data');
    }

    console.log('\n✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

// Ejecutar migración
addAmountColumns()
  .then(() => {
    console.log('\n🎉 Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
