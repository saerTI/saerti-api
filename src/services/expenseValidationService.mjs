// src/services/expenseValidationService.mjs
// Servicio de validación dinámica basada en configuración de expense_type

import { getExpenseTypeById } from '../models/expenseTypeModel.mjs';

/**
 * Validar datos de egreso según configuración del tipo
 */
export async function validateExpenseData(expenseData, expenseTypeId, organizationId) {
  const errors = [];
  const warnings = [];

  const expenseType = await getExpenseTypeById(expenseTypeId, organizationId);

  if (!expenseType) {
    errors.push({ field: 'expense_type_id', message: 'Tipo de egreso no encontrado' });
    return { valid: false, errors, warnings };
  }

  // Validar campos base requeridos
  if (expenseType.required_name && !expenseData.name) {
    errors.push({ field: 'name', message: 'El nombre es requerido' });
  }

  if (expenseType.required_date && !expenseData.date) {
    errors.push({ field: 'date', message: 'La fecha es requerida' });
  }

  if (expenseType.required_status && !expenseData.status_id) {
    errors.push({ field: 'status_id', message: 'El estado es requerido' });
  }

  if (expenseType.required_cost_center && !expenseData.cost_center_id) {
    errors.push({ field: 'cost_center_id', message: 'El centro de costo es requerido' });
  }

  // Validar campos opcionales según configuración
  if (expenseType.show_amount) {
    if (expenseType.required_amount && !expenseData.amount && expenseData.amount !== 0) {
      errors.push({ field: 'amount', message: 'El monto es requerido' });
    }
    if (expenseData.amount && expenseData.amount < 0) {
      errors.push({ field: 'amount', message: 'El monto no puede ser negativo' });
    }
  }

  if (expenseType.show_category && expenseType.required_category && !expenseData.category_id) {
    errors.push({ field: 'category_id', message: 'La categoría es requerida' });
  }

  if (expenseType.show_payment_date && expenseType.required_payment_date && !expenseData.payment_date) {
    errors.push({ field: 'payment_date', message: 'La fecha de pago es requerida' });
  }

  if (expenseType.show_reference_number && expenseType.required_reference_number && !expenseData.reference_number) {
    errors.push({ field: 'reference_number', message: 'El número de referencia es requerido' });
  }

  if (expenseType.show_payment_method && expenseType.required_payment_method && !expenseData.payment_method) {
    errors.push({ field: 'payment_method', message: 'El método de pago es requerido' });
  }

  if (expenseType.show_payment_status && expenseType.required_payment_status && !expenseData.payment_status) {
    errors.push({ field: 'payment_status', message: 'El estado de pago es requerido' });
  }

  if (expenseType.show_currency && expenseType.required_currency && !expenseData.currency) {
    errors.push({ field: 'currency', message: 'La moneda es requerida' });
  }

  if (expenseType.show_exchange_rate && expenseType.required_exchange_rate && !expenseData.exchange_rate) {
    errors.push({ field: 'exchange_rate', message: 'El tipo de cambio es requerido' });
  }

  if (expenseType.show_invoice_number && expenseType.required_invoice_number && !expenseData.invoice_number) {
    errors.push({ field: 'invoice_number', message: 'El número de factura es requerido' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Obtener campos visibles y configuración para un tipo de egreso
 */
export async function getVisibleFields(expenseTypeId, organizationId) {
  const expenseType = await getExpenseTypeById(expenseTypeId, organizationId);

  if (!expenseType) {
    return null;
  }

  const fields = {
    base: [
      { name: 'name', required: expenseType.required_name, type: 'text' },
      { name: 'description', required: false, type: 'textarea' },
      { name: 'notes', required: false, type: 'textarea' },
      { name: 'date', required: expenseType.required_date, type: 'date' },
      { name: 'status_id', required: expenseType.required_status, type: 'select' },
      { name: 'cost_center_id', required: expenseType.required_cost_center, type: 'select' }
    ],
    optional: []
  };

  if (expenseType.show_amount) {
    fields.optional.push({ name: 'amount', required: expenseType.required_amount, type: 'number' });
  }

  if (expenseType.show_category) {
    fields.optional.push({ name: 'category_id', required: expenseType.required_category, type: 'select' });
  }

  if (expenseType.show_payment_date) {
    fields.optional.push({ name: 'payment_date', required: expenseType.required_payment_date, type: 'date' });
  }

  if (expenseType.show_reference_number) {
    fields.optional.push({ name: 'reference_number', required: expenseType.required_reference_number, type: 'text' });
  }

  if (expenseType.show_payment_method) {
    fields.optional.push({
      name: 'payment_method',
      required: expenseType.required_payment_method,
      type: 'select',
      options: ['transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro']
    });
  }

  if (expenseType.show_payment_status) {
    fields.optional.push({
      name: 'payment_status',
      required: expenseType.required_payment_status,
      type: 'select',
      options: ['pendiente', 'parcial', 'pagado', 'anulado']
    });
  }

  if (expenseType.show_currency) {
    fields.optional.push({ name: 'currency', required: expenseType.required_currency, type: 'text' });
  }

  if (expenseType.show_exchange_rate) {
    fields.optional.push({ name: 'exchange_rate', required: expenseType.required_exchange_rate, type: 'number' });
  }

  if (expenseType.show_invoice_number) {
    fields.optional.push({ name: 'invoice_number', required: expenseType.required_invoice_number, type: 'text' });
  }

  return fields;
}
