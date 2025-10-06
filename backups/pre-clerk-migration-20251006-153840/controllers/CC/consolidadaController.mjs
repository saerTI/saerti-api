// src/controllers/CC/consolidadaController.mjs
import { pool } from '../../config/database.mjs';

/**
 * Controlador para vistas consolidadas de cuentas contables
 */
export default {
  
  /**
   * GET /api/consolidada/accounts
   * Vista consolidada de cuentas contables con purchase orders e invoices
   */
  async getConsolidatedAccounts(req, res, next) {
    try {
      console.log('🔍 Getting consolidated accounts with filters:', req.query);

      // Validar y construir filtros
      const filters = {};
      const queryParams = [];
      let whereConditions = ['1=1'];

      // Filtro por centro de costo
      if (req.query.cost_center_id && !isNaN(parseInt(req.query.cost_center_id))) {
        whereConditions.push('center_code = (SELECT code FROM cost_centers WHERE id = ?)');
        queryParams.push(parseInt(req.query.cost_center_id));
        filters.cost_center_id = parseInt(req.query.cost_center_id);
      }

      // Filtro por tipo de centro
      if (req.query.center_type) {
        whereConditions.push('center_type = ?');
        queryParams.push(req.query.center_type.trim());
        filters.center_type = req.query.center_type.trim();
      }

      // Filtro por estado de factura
      if (req.query.has_invoice) {
        const hasInvoice = req.query.has_invoice === 'true';
        whereConditions.push(hasInvoice ? 'invoice_id IS NOT NULL' : 'invoice_id IS NULL');
        filters.has_invoice = hasInvoice;
      }

      // Filtro por estado de pago
      if (req.query.payment_status) {
        whereConditions.push('payment_status = ?');
        queryParams.push(req.query.payment_status);
        filters.payment_status = req.query.payment_status;
      }

      // Filtro por proveedor
      if (req.query.supplier_name) {
        whereConditions.push('supplier_name LIKE ?');
        queryParams.push(`%${req.query.supplier_name}%`);
        filters.supplier_name = req.query.supplier_name;
      }

      // Filtro por rango de fechas
      if (req.query.date_from) {
        whereConditions.push('po_date >= ?');
        queryParams.push(req.query.date_from);
        filters.date_from = req.query.date_from;
      }

      if (req.query.date_to) {
        whereConditions.push('po_date <= ?');
        queryParams.push(req.query.date_to);
        filters.date_to = req.query.date_to;
      }

      // Filtro por grupo de cuenta
      if (req.query.account_group) {
        whereConditions.push('account_group = ?');
        queryParams.push(req.query.account_group);
        filters.account_group = req.query.account_group;
      }

      // Paginación
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;
      const offset = (page - 1) * limit;

      const whereClause = whereConditions.join(' AND ');

      // Verificar que la vista consolidada existe
      try {
        await pool.query('SELECT 1 FROM consolidated_accounts_view LIMIT 1');
      } catch (viewError) {
        console.error('❌ Vista consolidada no existe:', viewError.message);
        return res.status(500).json({
          success: false,
          message: 'Vista consolidada no configurada',
          error: 'La vista consolidated_accounts_view no existe en la base de datos',
          suggestion: 'Ejecutar el script de setup para crear la vista'
        });
      }

      // Obtener datos principales
      const [rows] = await pool.query(`
        SELECT 
          po_id,
          invoice_id,
          po_number,
          po_date,
          po_description,
          po_amount,
          po_status,
          center_code,
          center_name,
          center_type,
          center_client,
          supplier_name,
          account_code,
          account_name,
          account_group,
          unique_folio,
          invoice_number,
          issue_date,
          due_date,
          invoice_amount,
          document_status,
          payment_status,
          has_invoice,
          effective_amount
        FROM consolidated_accounts_view 
        WHERE ${whereClause}
        ORDER BY po_date DESC, po_id DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, limit, offset]);

      // Obtener total para paginación
      const [countResult] = await pool.query(`
        SELECT COUNT(*) AS total 
        FROM consolidated_accounts_view 
        WHERE ${whereClause}
      `, queryParams);

      const total = countResult[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      // Calcular resúmenes
      const [summaryResult] = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(po_amount) as total_po_amount,
          SUM(CASE WHEN invoice_id IS NOT NULL THEN invoice_amount ELSE 0 END) as total_invoice_amount,
          SUM(effective_amount) as total_effective_amount,
          COUNT(CASE WHEN invoice_id IS NOT NULL THEN 1 END) as records_with_invoice,
          COUNT(CASE WHEN payment_status = 'pagada' THEN 1 END) as paid_records
        FROM consolidated_accounts_view 
        WHERE ${whereClause}
      `, queryParams);

      const summary = summaryResult[0];

      res.json({
        success: true,
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary: {
          total_records: summary.total_records,
          total_po_amount: parseFloat(summary.total_po_amount || 0),
          total_invoice_amount: parseFloat(summary.total_invoice_amount || 0),
          total_effective_amount: parseFloat(summary.total_effective_amount || 0),
          invoice_coverage_percentage: summary.total_records > 0 
            ? ((summary.records_with_invoice / summary.total_records) * 100).toFixed(2)
            : 0,
          payment_percentage: summary.total_records > 0
            ? ((summary.paid_records / summary.total_records) * 100).toFixed(2) 
            : 0
        },
        applied_filters: filters,
        metadata: {
          total_results: total,
          filters_applied: Object.keys(filters).length,
          query_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in getConsolidatedAccounts:', error);
      next(error);
    }
  },

  /**
   * GET /api/consolidada/by-center
   * Vista de costos agrupados por centro de costo
   */
  async getCostsByCenter(req, res, next) {
    try {
      console.log('🔍 Getting costs by center with filters:', req.query);

      const filters = {};
      const queryParams = [];
      let whereConditions = ['1=1'];

      // Filtro por tipo de centro
      if (req.query.center_type) {
        whereConditions.push('center_type = ?');
        queryParams.push(req.query.center_type.trim());
        filters.center_type = req.query.center_type.trim();
      }

      // Filtro por período
      if (req.query.period) {
        whereConditions.push('period = ?');
        queryParams.push(req.query.period);
        filters.period = req.query.period;
      }

      const whereClause = whereConditions.join(' AND ');

      // Verificar que la vista exists
      try {
        await pool.query('SELECT 1 FROM costs_by_center_view LIMIT 1');
      } catch (viewError) {
        console.error('❌ Vista costs_by_center no existe:', viewError.message);
        return res.status(500).json({
          success: false,
          message: 'Vista de costos por centro no configurada',
          error: 'La vista costs_by_center_view no existe en la base de datos'
        });
      }

      const [rows] = await pool.query(`
        SELECT 
          cost_center_id,
          center_code,
          center_name,
          center_type,
          center_client,
          account_id,
          account_code,
          account_name,
          account_group,
          period,
          cost_count,
          total_real,
          total_budget,
          total_estimated,
          total_general,
          budget_deviation,
          center_percentage,
          first_cost_date,
          last_cost_date
        FROM costs_by_center_view 
        WHERE ${whereClause}
        ORDER BY center_code, account_code, period DESC
      `, queryParams);

      // Agrupar por centro de costo
      const centerGroups = rows.reduce((acc, row) => {
        const centerId = row.cost_center_id;
        if (!acc[centerId]) {
          acc[centerId] = {
            center_info: {
              id: row.cost_center_id,
              code: row.center_code,
              name: row.center_name,
              type: row.center_type,
              client: row.center_client
            },
            accounts: [],
            totals: {
              cost_count: 0,
              total_real: 0,
              total_budget: 0,
              total_estimated: 0,
              total_general: 0
            }
          };
        }

        acc[centerId].accounts.push({
          account_id: row.account_id,
          account_code: row.account_code,
          account_name: row.account_name,
          account_group: row.account_group,
          period: row.period,
          cost_count: row.cost_count,
          total_real: parseFloat(row.total_real || 0),
          total_budget: parseFloat(row.total_budget || 0),
          total_estimated: parseFloat(row.total_estimated || 0),
          total_general: parseFloat(row.total_general || 0),
          budget_deviation: parseFloat(row.budget_deviation || 0),
          center_percentage: parseFloat(row.center_percentage || 0)
        });

        // Acumular totales
        acc[centerId].totals.cost_count += row.cost_count;
        acc[centerId].totals.total_real += parseFloat(row.total_real || 0);
        acc[centerId].totals.total_budget += parseFloat(row.total_budget || 0);
        acc[centerId].totals.total_estimated += parseFloat(row.total_estimated || 0);
        acc[centerId].totals.total_general += parseFloat(row.total_general || 0);

        return acc;
      }, {});

      res.json({
        success: true,
        data: Object.values(centerGroups),
        applied_filters: filters,
        metadata: {
          centers_count: Object.keys(centerGroups).length,
          total_accounts: rows.length,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in getCostsByCenter:', error);
      next(error);
    }
  },

  /**
   * GET /api/consolidada/summary
   * Resumen general de cuentas consolidadas
   */
  async getConsolidatedSummary(req, res, next) {
    try {
      console.log('🔍 Getting consolidated summary');

      // Resumen de purchase orders
      const [poSummary] = await pool.query(`
        SELECT 
          COUNT(*) as total_pos,
          SUM(total) as total_po_amount,
          COUNT(CASE WHEN status = 'borrador' THEN 1 END) as draft_pos,
          COUNT(CASE WHEN status = 'confirmado' THEN 1 END) as confirmed_pos,
          COUNT(DISTINCT cost_center_id) as unique_centers,
          COUNT(DISTINCT account_category_id) as unique_categories
        FROM purchase_orders
      `);

      // Resumen por centro de costo
      const [centerSummary] = await pool.query(`
        SELECT 
          cc.code,
          cc.name,
          cc.type,
          COUNT(po.id) as po_count,
          SUM(po.total) as total_amount
        FROM cost_centers cc
        LEFT JOIN purchase_orders po ON cc.id = po.cost_center_id
        GROUP BY cc.id, cc.code, cc.name, cc.type
        ORDER BY total_amount DESC
      `);

      // Resumen por grupo de cuenta
      const [accountSummary] = await pool.query(`
        SELECT 
          ac.group_name,
          COUNT(po.id) as po_count,
          SUM(po.total) as total_amount
        FROM account_categories ac
        LEFT JOIN purchase_orders po ON ac.id = po.account_category_id
        GROUP BY ac.group_name
        ORDER BY total_amount DESC
      `);

      res.json({
        success: true,
        data: {
          general: poSummary[0],
          by_center: centerSummary,
          by_account_group: accountSummary
        },
        metadata: {
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error in getConsolidatedSummary:', error);
      next(error);
    }
  }
};