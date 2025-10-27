// src/services/incomeValidationService.mjs
// Servicio de validación dinámica basada en configuración de income_type

import { getIncomeTypeById } from '../models/incomeTypeModel.mjs';

/**
 * Validar datos de ingreso según configuración del tipo
 */
export async function validateIncomeData(incomeData, incomeTypeId, organizationId) {
  const errors = [];
  const warnings = [];

  const incomeType = await getIncomeTypeById(incomeTypeId, organizationId);

  if (!incomeType) {
    errors.push({ field: 'income_type_id', message: 'Tipo de ingreso no encontrado' });
    return { valid: false, errors, warnings };
  }

  // Validar campos base requeridos
  if (incomeType.required_name && !incomeData.name) {
    errors.push({ field: 'name', message: 'El nombre es requerido' });
  }

  if (incomeType.required_date && !incomeData.date) {
    errors.push({ field: 'date', message: 'La fecha es requerida' });
  }

  if (incomeType.required_status && !incomeData.status_id) {
    errors.push({ field: 'status_id', message: 'El estado es requerido' });
  }

  if (incomeType.required_cost_center && !incomeData.cost_center_id) {
    errors.push({ field: 'cost_center_id', message: 'El centro de costo es requerido' });
  }

  // Validar campos opcionales según configuración
  if (incomeType.show_amount) {
    if (incomeType.required_amount && !incomeData.amount && incomeData.amount !== 0) {
      errors.push({ field: 'amount', message: 'El monto es requerido' });
    }
    if (incomeData.amount && incomeData.amount < 0) {
      errors.push({ field: 'amount', message: 'El monto no puede ser negativo' });
    }
  }

  if (incomeType.show_category && incomeType.required_category && !incomeData.category_id) {
    errors.push({ field: 'category_id', message: 'La categoría es requerida' });
  }

  if (incomeType.show_payment_date && incomeType.required_payment_date && !incomeData.payment_date) {
    errors.push({ field: 'payment_date', message: 'La fecha de pago es requerida' });
  }

  if (incomeType.show_reference_number && incomeType.required_reference_number && !incomeData.reference_number) {
    errors.push({ field: 'reference_number', message: 'El número de referencia es requerido' });
  }

  if (incomeType.show_payment_method && incomeType.required_payment_method && !incomeData.payment_method) {
    errors.push({ field: 'payment_method', message: 'El método de pago es requerido' });
  }

  if (incomeType.show_payment_status && incomeType.required_payment_status && !incomeData.payment_status) {
    errors.push({ field: 'payment_status', message: 'El estado de pago es requerido' });
  }

  if (incomeType.show_currency && incomeType.required_currency && !incomeData.currency) {
    errors.push({ field: 'currency', message: 'La moneda es requerida' });
  }

  if (incomeType.show_exchange_rate && incomeType.required_exchange_rate && !incomeData.exchange_rate) {
    errors.push({ field: 'exchange_rate', message: 'El tipo de cambio es requerido' });
  }

  if (incomeType.show_invoice_number && incomeType.required_invoice_number && !incomeData.invoice_number) {
    errors.push({ field: 'invoice_number', message: 'El número de factura es requerido' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Obtener campos visibles y configuración para un tipo de ingreso
 */
export async function getVisibleFields(incomeTypeId, organizationId) {
  const incomeType = await getIncomeTypeById(incomeTypeId, organizationId);

  if (!incomeType) {
    return null;
  }

  const fields = {
    base: [
      { name: 'name', required: incomeType.required_name, type: 'text' },
      { name: 'description', required: false, type: 'textarea' },
      { name: 'notes', required: false, type: 'textarea' },
      { name: 'date', required: incomeType.required_date, type: 'date' },
      { name: 'status_id', required: incomeType.required_status, type: 'select' },
      { name: 'cost_center_id', required: incomeType.required_cost_center, type: 'select' }
    ],
    optional: []
  };

  if (incomeType.show_amount) {
    fields.optional.push({ name: 'amount', required: incomeType.required_amount, type: 'number' });
  }

  if (incomeType.show_category) {
    fields.optional.push({ name: 'category_id', required: incomeType.required_category, type: 'select' });
  }

  if (incomeType.show_payment_date) {
    fields.optional.push({ name: 'payment_date', required: incomeType.required_payment_date, type: 'date' });
  }

  if (incomeType.show_reference_number) {
    fields.optional.push({ name: 'reference_number', required: incomeType.required_reference_number, type: 'text' });
  }

  if (incomeType.show_payment_method) {
    fields.optional.push({
      name: 'payment_method',
      required: incomeType.required_payment_method,
      type: 'select',
      options: ['transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro']
    });
  }

  if (incomeType.show_payment_status) {
    fields.optional.push({
      name: 'payment_status',
      required: incomeType.required_payment_status,
      type: 'select',
      options: ['pendiente', 'parcial', 'pagado', 'anulado']
    });
  }

  if (incomeType.show_currency) {
    fields.optional.push({ name: 'currency', required: incomeType.required_currency, type: 'text' });
  }

  if (incomeType.show_exchange_rate) {
    fields.optional.push({ name: 'exchange_rate', required: incomeType.required_exchange_rate, type: 'number' });
  }

  if (incomeType.show_invoice_number) {
    fields.optional.push({ name: 'invoice_number', required: incomeType.required_invoice_number, type: 'text' });
  }

  return fields;
}
