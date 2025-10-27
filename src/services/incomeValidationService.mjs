// src/services/incomeValidationService.mjs
// Servicio de validación dinámica basada en configuración de income_type

import { getIncomeTypeById } from '../models/incomeTypeModel.mjs';

/**
 * Validar datos de ingreso según configuración del tipo
 * @param {Object} incomeData - Datos del ingreso a validar
 * @param {number} incomeTypeId - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 * @returns {Object} { valid: boolean, errors: Array, warnings: Array }
 */
export async function validateIncomeData(incomeData, incomeTypeId, organizationId) {
  const errors = [];
  const warnings = [];

  // Obtener configuración del tipo
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
  } else {
    // Campo no visible, ignorar si viene
    if (incomeData.amount) {
      warnings.push({ field: 'amount', message: 'El campo amount no está visible para este tipo, será ignorado' });
      delete incomeData.amount;
    }
  }

  if (incomeType.show_category) {
    if (incomeType.required_category && !incomeData.category_id) {
      errors.push({ field: 'category_id', message: 'La categoría es requerida' });
    }
  } else {
    if (incomeData.category_id) {
      warnings.push({ field: 'category_id', message: 'El campo category_id no está visible para este tipo, será ignorado' });
      delete incomeData.category_id;
    }
  }

  if (incomeType.show_payment_date) {
    if (incomeType.required_payment_date && !incomeData.payment_date) {
      errors.push({ field: 'payment_date', message: 'La fecha de pago es requerida' });
    }
    if (incomeData.payment_date && incomeData.date && new Date(incomeData.payment_date) < new Date(incomeData.date)) {
      warnings.push({ field: 'payment_date', message: 'La fecha de pago es anterior a la fecha del ingreso' });
    }
  } else {
    if (incomeData.payment_date) {
      warnings.push({ field: 'payment_date', message: 'El campo payment_date no está visible para este tipo, será ignorado' });
      delete incomeData.payment_date;
    }
  }

  if (incomeType.show_reference_number) {
    if (incomeType.required_reference_number && !incomeData.reference_number) {
      errors.push({ field: 'reference_number', message: 'El número de referencia es requerido' });
    }
  } else {
    if (incomeData.reference_number) {
      warnings.push({ field: 'reference_number', message: 'El campo reference_number no está visible para este tipo, será ignorado' });
      delete incomeData.reference_number;
    }
  }

  if (incomeType.show_tax_amount) {
    if (incomeType.required_tax_amount && !incomeData.tax_amount && incomeData.tax_amount !== 0) {
      errors.push({ field: 'tax_amount', message: 'El monto de impuesto es requerido' });
    }
    if (incomeData.tax_amount && incomeData.tax_amount < 0) {
      errors.push({ field: 'tax_amount', message: 'El monto de impuesto no puede ser negativo' });
    }
  } else {
    if (incomeData.tax_amount) {
      warnings.push({ field: 'tax_amount', message: 'El campo tax_amount no está visible para este tipo, será ignorado' });
      delete incomeData.tax_amount;
    }
  }

  if (incomeType.show_net_amount) {
    if (incomeType.required_net_amount && !incomeData.net_amount && incomeData.net_amount !== 0) {
      errors.push({ field: 'net_amount', message: 'El monto neto es requerido' });
    }
    if (incomeData.net_amount && incomeData.net_amount < 0) {
      errors.push({ field: 'net_amount', message: 'El monto neto no puede ser negativo' });
    }
  } else {
    if (incomeData.net_amount) {
      warnings.push({ field: 'net_amount', message: 'El campo net_amount no está visible para este tipo, será ignorado' });
      delete incomeData.net_amount;
    }
  }

  if (incomeType.show_total_amount) {
    if (incomeType.required_total_amount && !incomeData.total_amount && incomeData.total_amount !== 0) {
      errors.push({ field: 'total_amount', message: 'El monto total es requerido' });
    }
    if (incomeData.total_amount && incomeData.total_amount < 0) {
      errors.push({ field: 'total_amount', message: 'El monto total no puede ser negativo' });
    }
    // Validación cruzada: si hay net_amount y tax_amount, verificar que total_amount sea la suma
    if (incomeData.net_amount && incomeData.tax_amount && incomeData.total_amount) {
      const calculatedTotal = parseFloat(incomeData.net_amount) + parseFloat(incomeData.tax_amount);
      const providedTotal = parseFloat(incomeData.total_amount);
      if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
        warnings.push({
          field: 'total_amount',
          message: `El monto total (${providedTotal}) no coincide con la suma de neto + impuesto (${calculatedTotal})`
        });
      }
    }
  } else {
    if (incomeData.total_amount) {
      warnings.push({ field: 'total_amount', message: 'El campo total_amount no está visible para este tipo, será ignorado' });
      delete incomeData.total_amount;
    }
  }

  if (incomeType.show_payment_method) {
    if (incomeType.required_payment_method && !incomeData.payment_method) {
      errors.push({ field: 'payment_method', message: 'El método de pago es requerido' });
    }
    if (incomeData.payment_method) {
      const validMethods = ['transferencia', 'cheque', 'efectivo', 'tarjeta', 'otro'];
      if (!validMethods.includes(incomeData.payment_method)) {
        errors.push({ field: 'payment_method', message: `Método de pago inválido. Valores permitidos: ${validMethods.join(', ')}` });
      }
    }
  } else {
    if (incomeData.payment_method) {
      warnings.push({ field: 'payment_method', message: 'El campo payment_method no está visible para este tipo, será ignorado' });
      delete incomeData.payment_method;
    }
  }

  if (incomeType.show_payment_status) {
    if (incomeType.required_payment_status && !incomeData.payment_status) {
      errors.push({ field: 'payment_status', message: 'El estado de pago es requerido' });
    }
    if (incomeData.payment_status) {
      const validStatuses = ['pendiente', 'parcial', 'pagado', 'anulado'];
      if (!validStatuses.includes(incomeData.payment_status)) {
        errors.push({ field: 'payment_status', message: `Estado de pago inválido. Valores permitidos: ${validStatuses.join(', ')}` });
      }
    }
  } else {
    if (incomeData.payment_status) {
      warnings.push({ field: 'payment_status', message: 'El campo payment_status no está visible para este tipo, será ignorado' });
      delete incomeData.payment_status;
    }
  }

  if (incomeType.show_currency) {
    if (incomeType.required_currency && !incomeData.currency) {
      errors.push({ field: 'currency', message: 'La moneda es requerida' });
    }
    if (incomeData.currency && incomeData.currency.length > 10) {
      errors.push({ field: 'currency', message: 'El código de moneda no puede tener más de 10 caracteres' });
    }
  } else {
    if (incomeData.currency && incomeData.currency !== 'CLP') {
      warnings.push({ field: 'currency', message: 'El campo currency no está visible para este tipo, será ignorado' });
      delete incomeData.currency;
    }
  }

  if (incomeType.show_exchange_rate) {
    if (incomeType.required_exchange_rate && !incomeData.exchange_rate && incomeData.exchange_rate !== 0) {
      errors.push({ field: 'exchange_rate', message: 'El tipo de cambio es requerido' });
    }
    if (incomeData.exchange_rate && incomeData.exchange_rate <= 0) {
      errors.push({ field: 'exchange_rate', message: 'El tipo de cambio debe ser mayor a 0' });
    }
  } else {
    if (incomeData.exchange_rate) {
      warnings.push({ field: 'exchange_rate', message: 'El campo exchange_rate no está visible para este tipo, será ignorado' });
      delete incomeData.exchange_rate;
    }
  }

  if (incomeType.show_invoice_number) {
    if (incomeType.required_invoice_number && !incomeData.invoice_number) {
      errors.push({ field: 'invoice_number', message: 'El número de factura es requerido' });
    }
  } else {
    if (incomeData.invoice_number) {
      warnings.push({ field: 'invoice_number', message: 'El campo invoice_number no está visible para este tipo, será ignorado' });
      delete incomeData.invoice_number;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    incomeType // Devolver configuración del tipo para uso posterior
  };
}

/**
 * Obtener campos visibles para un tipo de ingreso
 * @param {number} incomeTypeId - ID del tipo de ingreso
 * @param {string} organizationId - ID de la organización
 * @returns {Object} Objeto con campos visibles y requeridos
 */
export async function getVisibleFields(incomeTypeId, organizationId) {
  const incomeType = await getIncomeTypeById(incomeTypeId, organizationId);

  if (!incomeType) {
    return null;
  }

  const fields = {
    // Campos base (siempre presentes)
    base: [
      { name: 'name', required: incomeType.required_name, type: 'text' },
      { name: 'description', required: false, type: 'textarea' },
      { name: 'notes', required: false, type: 'textarea' },
      { name: 'date', required: incomeType.required_date, type: 'date' },
      { name: 'status_id', required: incomeType.required_status, type: 'select' },
      { name: 'cost_center_id', required: incomeType.required_cost_center, type: 'select' }
    ],
    // Campos opcionales (solo si show_* = true)
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

  if (incomeType.show_tax_amount) {
    fields.optional.push({ name: 'tax_amount', required: incomeType.required_tax_amount, type: 'number' });
  }

  if (incomeType.show_net_amount) {
    fields.optional.push({ name: 'net_amount', required: incomeType.required_net_amount, type: 'number' });
  }

  if (incomeType.show_total_amount) {
    fields.optional.push({ name: 'total_amount', required: incomeType.required_total_amount, type: 'number' });
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
