import pool from '../../config/database.mjs';

export const consolidadaModel = {

  // ==========================================
  // OBTENER DATOS DE LA VISTA CONSOLIDADA
  // ==========================================

  // Obtener datos consolidados con filtros y paginación
  async getAll(filters = {}, page = 1, limit = 25) {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT 
          oc_id,
          factura_id,
          numero_oc,
          fecha_oc,
          descripcion_oc,
          monto_oc,
          estado_oc,
          centro_codigo,
          centro_nombre,
          centro_tipo,
          centro_descripcion,
          centro_cliente,
          centro_ubicacion,
          proveedor_rut,
          proveedor_nombre,
          cuenta_codigo,
          cuenta_nombre,
          cuenta_grupo,
          cuenta_tipo,
          folio_unico,
          folio_dcto,
          numero_factura,
          fecha_emision,
          fecha_estimada_pago,
          fecha_vencimiento,
          monto_factura,
          estado_documento,
          estado_pago,
          comentario_factura,
          estado_sii,
          monto_pagado,
          fecha_ultimo_pago,
          tiene_factura,
          monto_efectivo,
          estado_general,
          dias_vencimiento,
          urgencia_pago,
          tipo_registro,
          clasificacion_centro,
          fecha_creacion_oc,
          fecha_creacion_factura
        FROM vista_cuentas_consolidada
        WHERE 1=1
      `;

      const params = [];

      // Aplicar filtros
      if (filters.numero_oc) {
        query += ' AND numero_oc LIKE ?';
        params.push(`%${filters.numero_oc}%`);
      }

      if (filters.estado_general) {
        query += ' AND estado_general = ?';
        params.push(filters.estado_general);
      }

      if (filters.proveedor_nombre) {
        query += ' AND proveedor_nombre LIKE ?';
        params.push(`%${filters.proveedor_nombre}%`);
      }

      if (filters.centro_tipo) {
        query += ' AND centro_tipo = ?';
        params.push(filters.centro_tipo);
      }

      if (filters.centro_codigo) {
        query += ' AND centro_codigo = ?';
        params.push(filters.centro_codigo);
      }

      if (filters.cuenta_grupo) {
        query += ' AND cuenta_grupo = ?';
        params.push(filters.cuenta_grupo);
      }

      if (filters.urgencia_pago) {
        query += ' AND urgencia_pago = ?';
        params.push(filters.urgencia_pago);
      }

      if (filters.tiene_factura) {
        query += ' AND tiene_factura = ?';
        params.push(filters.tiene_factura);
      }

      if (filters.fecha_desde) {
        query += ' AND fecha_oc >= ?';
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query += ' AND fecha_oc <= ?';
        params.push(filters.fecha_hasta);
      }

      if (filters.monto_min) {
        query += ' AND monto_efectivo >= ?';
        params.push(filters.monto_min);
      }

      if (filters.monto_max) {
        query += ' AND monto_efectivo <= ?';
        params.push(filters.monto_max);
      }

      if (filters.vencidos_solamente) {
        query += ' AND urgencia_pago = "Vencido"';
      }

      if (filters.urgentes_solamente) {
        query += ' AND urgencia_pago IN ("Vencido", "Urgente")';
      }

      // Ordenamiento
      let orderBy = 'fecha_oc DESC, numero_oc DESC';
      if (filters.order_by) {
        switch (filters.order_by) {
          case 'fecha_vencimiento':
            orderBy = 'fecha_vencimiento ASC, urgencia_pago DESC';
            break;
          case 'monto':
            orderBy = 'monto_efectivo DESC';
            break;
          case 'proveedor':
            orderBy = 'proveedor_nombre ASC';
            break;
          case 'estado':
            orderBy = 'estado_general ASC, fecha_oc DESC';
            break;
          case 'centro':
            orderBy = 'centro_nombre ASC, fecha_oc DESC';
            break;
        }
      }

      query += ` ORDER BY ${orderBy}`;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [registros] = await pool.execute(query, params);

      // Contar total para paginación
      let countQuery = `
        SELECT COUNT(*) as total
        FROM vista_cuentas_consolidada
        WHERE 1=1
      `;
      
      const countParams = [];
      // Aplicar los mismos filtros para el conteo
      if (filters.numero_oc) {
        countQuery += ' AND numero_oc LIKE ?';
        countParams.push(`%${filters.numero_oc}%`);
      }
      if (filters.estado_general) {
        countQuery += ' AND estado_general = ?';
        countParams.push(filters.estado_general);
      }
      if (filters.proveedor_nombre) {
        countQuery += ' AND proveedor_nombre LIKE ?';
        countParams.push(`%${filters.proveedor_nombre}%`);
      }
      if (filters.centro_tipo) {
        countQuery += ' AND centro_tipo = ?';
        countParams.push(filters.centro_tipo);
      }
      if (filters.centro_codigo) {
        countQuery += ' AND centro_codigo = ?';
        countParams.push(filters.centro_codigo);
      }
      if (filters.cuenta_grupo) {
        countQuery += ' AND cuenta_grupo = ?';
        countParams.push(filters.cuenta_grupo);
      }
      if (filters.urgencia_pago) {
        countQuery += ' AND urgencia_pago = ?';
        countParams.push(filters.urgencia_pago);
      }
      if (filters.tiene_factura) {
        countQuery += ' AND tiene_factura = ?';
        countParams.push(filters.tiene_factura);
      }
      if (filters.fecha_desde) {
        countQuery += ' AND fecha_oc >= ?';
        countParams.push(filters.fecha_desde);
      }
      if (filters.fecha_hasta) {
        countQuery += ' AND fecha_oc <= ?';
        countParams.push(filters.fecha_hasta);
      }
      if (filters.monto_min) {
        countQuery += ' AND monto_efectivo >= ?';
        countParams.push(filters.monto_min);
      }
      if (filters.monto_max) {
        countQuery += ' AND monto_efectivo <= ?';
        countParams.push(filters.monto_max);
      }
      if (filters.vencidos_solamente) {
        countQuery += ' AND urgencia_pago = "Vencido"';
      }
      if (filters.urgentes_solamente) {
        countQuery += ' AND urgencia_pago IN ("Vencido", "Urgente")';
      }

      const [countResult] = await pool.execute(countQuery, countParams);
      const total = countResult[0].total;

      return {
        registros,
        pagination: {
          current_page: page,
          per_page: limit,
          total: total,
          total_pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        }
      };
    } catch (error) {
      console.error('Error en getAll consolidada:', error);
      throw error;
    }
  },

  // ==========================================
  // ESTADÍSTICAS Y RESÚMENES
  // ==========================================

  // Obtener estadísticas generales
  async getStats(filters = {}) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_registros,
          SUM(monto_efectivo) as monto_total,
          COUNT(CASE WHEN tiene_factura = 'Con Factura' THEN 1 END) as con_factura,
          COUNT(CASE WHEN tiene_factura = 'Sin Factura' THEN 1 END) as sin_factura,
          COUNT(CASE WHEN estado_general = 'Pagado' THEN 1 END) as pagados,
          COUNT(CASE WHEN urgencia_pago = 'Vencido' THEN 1 END) as vencidos,
          COUNT(CASE WHEN urgencia_pago = 'Urgente' THEN 1 END) as urgentes,
          COUNT(CASE WHEN centro_tipo = 'proyecto' THEN 1 END) as proyectos,
          COUNT(CASE WHEN centro_tipo = 'administrativo' THEN 1 END) as administrativos,
          SUM(CASE WHEN estado_general = 'Pagado' THEN monto_efectivo ELSE 0 END) as monto_pagado,
          SUM(CASE WHEN estado_general != 'Pagado' THEN monto_efectivo ELSE 0 END) as monto_pendiente
        FROM vista_cuentas_consolidada
        WHERE 1=1
      `;

      const params = [];

      // Aplicar filtros básicos
      if (filters.fecha_desde) {
        query += ' AND fecha_oc >= ?';
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query += ' AND fecha_oc <= ?';
        params.push(filters.fecha_hasta);
      }

      if (filters.centro_tipo) {
        query += ' AND centro_tipo = ?';
        params.push(filters.centro_tipo);
      }

      const [rows] = await pool.execute(query, params);
      return rows[0];
    } catch (error) {
      console.error('Error en getStats consolidada:', error);
      throw error;
    }
  },

  // Resumen por estado general
  async getResumenPorEstado(filters = {}) {
    try {
      let query = `
        SELECT 
          estado_general,
          COUNT(*) as cantidad,
          SUM(monto_efectivo) as monto_total,
          AVG(monto_efectivo) as monto_promedio
        FROM vista_cuentas_consolidada
        WHERE 1=1
      `;

      const params = [];

      if (filters.fecha_desde) {
        query += ' AND fecha_oc >= ?';
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query += ' AND fecha_oc <= ?';
        params.push(filters.fecha_hasta);
      }

      query += ' GROUP BY estado_general ORDER BY monto_total DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error en getResumenPorEstado:', error);
      throw error;
    }
  },

  // Resumen por centro de costo
  async getResumenPorCentro(filters = {}) {
    try {
      let query = `
        SELECT 
          centro_codigo,
          centro_nombre,
          centro_tipo,
          COUNT(*) as cantidad_ordenes,
          SUM(monto_efectivo) as monto_total,
          COUNT(CASE WHEN tiene_factura = 'Con Factura' THEN 1 END) as con_factura,
          COUNT(CASE WHEN estado_general = 'Pagado' THEN 1 END) as pagados
        FROM vista_cuentas_consolidada
        WHERE 1=1
      `;

      const params = [];

      if (filters.fecha_desde) {
        query += ' AND fecha_oc >= ?';
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query += ' AND fecha_oc <= ?';
        params.push(filters.fecha_hasta);
      }

      if (filters.centro_tipo) {
        query += ' AND centro_tipo = ?';
        params.push(filters.centro_tipo);
      }

      query += ' GROUP BY centro_codigo, centro_nombre, centro_tipo ORDER BY monto_total DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error en getResumenPorCentro:', error);
      throw error;
    }
  },

  // Resumen por grupo de cuenta
  async getResumenPorGrupoCuenta(filters = {}) {
    try {
      let query = `
        SELECT 
          cuenta_grupo,
          COUNT(*) as cantidad_ordenes,
          SUM(monto_efectivo) as monto_total,
          AVG(monto_efectivo) as monto_promedio,
          COUNT(CASE WHEN estado_general = 'Pagado' THEN 1 END) as pagados
        FROM vista_cuentas_consolidada
        WHERE cuenta_grupo IS NOT NULL
      `;

      const params = [];

      if (filters.fecha_desde) {
        query += ' AND fecha_oc >= ?';
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        query += ' AND fecha_oc <= ?';
        params.push(filters.fecha_hasta);
      }

      query += ' GROUP BY cuenta_grupo ORDER BY monto_total DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error en getResumenPorGrupoCuenta:', error);
      throw error;
    }
  },

  // Obtener registros próximos a vencer
  async getProximosVencer(dias = 7) {
    try {
      const query = `
        SELECT 
          numero_oc,
          proveedor_nombre,
          monto_factura,
          fecha_vencimiento,
          dias_vencimiento,
          urgencia_pago,
          estado_general
        FROM vista_cuentas_consolidada
        WHERE fecha_vencimiento IS NOT NULL 
          AND dias_vencimiento <= ? 
          AND estado_general != 'Pagado'
        ORDER BY dias_vencimiento ASC
      `;

      const [rows] = await pool.execute(query, [dias]);
      return rows;
    } catch (error) {
      console.error('Error en getProximosVencer:', error);
      throw error;
    }
  },

  // ==========================================
  // MÉTODOS AUXILIARES
  // ==========================================

  // Obtener opciones de filtros
  async getFilterOptions() {
    try {
      const [estados] = await pool.execute(`
        SELECT DISTINCT estado_general 
        FROM vista_cuentas_consolidada 
        WHERE estado_general IS NOT NULL
        ORDER BY estado_general
      `);

      const [centros] = await pool.execute(`
        SELECT DISTINCT centro_codigo, centro_nombre, centro_tipo 
        FROM vista_cuentas_consolidada 
        WHERE centro_codigo IS NOT NULL
        ORDER BY centro_nombre
      `);

      const [grupos] = await pool.execute(`
        SELECT DISTINCT cuenta_grupo 
        FROM vista_cuentas_consolidada 
        WHERE cuenta_grupo IS NOT NULL
        ORDER BY cuenta_grupo
      `);

      const [proveedores] = await pool.execute(`
        SELECT DISTINCT proveedor_nombre 
        FROM vista_cuentas_consolidada 
        WHERE proveedor_nombre IS NOT NULL
        ORDER BY proveedor_nombre
      `);

      return {
        estados: estados.map(e => e.estado_general),
        centros: centros,
        grupos: grupos.map(g => g.cuenta_grupo),
        proveedores: proveedores.map(p => p.proveedor_nombre)
      };
    } catch (error) {
      console.error('Error en getFilterOptions:', error);
      throw error;
    }
  }
};

export default consolidadaModel;