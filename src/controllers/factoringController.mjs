// src/controllers/factoringController.mjs
import FactoringModel from '../models/factoringModel.mjs';
import FactoringEntityModel from '../models/factoringEntityModel.mjs';
import ProjectModel from '../models/projectModel.mjs'; // CostCenter is managed in projectModel

/**
 * Obtiene todos los factorings con sus entidades y centros de costo asociados
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getAllFactorings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      factoring_entities_id, 
      cost_center_id,
      date_from,
      date_to
    } = req.query;
    
    console.log('📥 getAllFactorings - Request params:', { 
      page, 
      limit, 
      status, 
      factoring_entities_id, 
      cost_center_id,
      date_from,
      date_to
    });
    
    // Crear objeto de filtros
    const filters = {};
    if (status) filters.status = status;
    if (factoring_entities_id) filters.factoring_entities_id = parseInt(factoring_entities_id);
    if (cost_center_id) filters.cost_center_id = parseInt(cost_center_id);
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    
    const result = await FactoringModel.getAll(
      parseInt(page), 
      parseInt(limit), 
      filters
    );
    
    console.log('📤 getAllFactorings - Model result:', {
      hasResult: !!result,
      hasData: !!result?.data,
      dataType: typeof result?.data,
      dataLength: result?.data?.length
    });
    
    // Verificar que result y result.data existan
    if (!result || !result.data) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        }
      });
    }
    
    // Transformar los datos para incluir las asociaciones como objetos anidados
    const factoringsWithAssociations = result.data.map(factoring => ({
      id: factoring.id,
      factoring_entities_id: factoring.factoring_entities_id,
      interest_rate: factoring.interest_rate,
      mount: factoring.mount,
      cost_center_id: factoring.cost_center_id,
      date_factoring: factoring.date_factoring,
      date_expiration: factoring.date_expiration,
      payment_status: factoring.payment_status,
      status: factoring.status,
      created_at: factoring.created_at,
      updated_at: factoring.updated_at,
      // Asociaciones con alias como solicitado
      entity: {
        id: factoring.factoring_entities_id,
        name: factoring.entity_name
      },
      costCenter: {
        id: factoring.cost_center_id,
        name: factoring.cost_center_name
      }
    }));

    res.status(200).json({
      success: true,
      data: factoringsWithAssociations,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in getAllFactorings:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtiene un factoring por su ID con sus entidades y centros de costo asociados
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getFactoringById = async (req, res) => {
  try {
    const { id } = req.params;
    const factoring = await FactoringModel.getById(id);

    if (!factoring) {
      return res.status(404).json({
        success: false,
        message: 'Factoring no encontrado'
      });
    }

    // Transformar los datos para incluir las asociaciones como objetos anidados
    const factoringWithAssociations = {
      id: factoring.id,
      factoring_entities_id: factoring.factoring_entities_id,
      interest_rate: factoring.interest_rate,
      mount: factoring.mount,
      cost_center_id: factoring.cost_center_id,
      date_factoring: factoring.date_factoring,
      date_expiration: factoring.date_expiration,
      payment_status: factoring.payment_status,
      status: factoring.status,
      created_at: factoring.created_at,
      updated_at: factoring.updated_at,
      // Asociaciones con alias como solicitado
      entity: {
        name: factoring.entity_name
      },
      costCenter: {
        name: factoring.cost_center_name
      }
    };

    res.status(200).json({
      success: true,
      data: factoringWithAssociations
    });
  } catch (error) {
    console.error('Error in getFactoringById:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Crea un nuevo factoring
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createFactoring = async (req, res) => {
  try {
    const factoringData = req.body;
    console.log('📥 Creating factoring with data:', JSON.stringify(factoringData, null, 2));

    // Validar que la entidad de factoring existe
    if (factoringData.factoring_entities_id) {
      const entity = await FactoringEntityModel.getById(factoringData.factoring_entities_id);
      if (!entity) {
        return res.status(400).json({
          success: false,
          message: 'Entidad de factoring no encontrada'
        });
      }
    }

    // Validar que el centro de costo existe
    if (factoringData.cost_center_id) {
      const costCenter = await ProjectModel.getById(factoringData.cost_center_id);
      if (!costCenter) {
        return res.status(400).json({
          success: false,
          message: 'Centro de costo no encontrado'
        });
      }
    }

    const newFactoring = await FactoringModel.create(factoringData);

    res.status(201).json({
      success: true,
      message: 'Factoring creado exitosamente',
      data: newFactoring
    });
  } catch (error) {
    console.error('Error in createFactoring:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Actualiza un factoring existente
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const updateFactoring = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar que el factoring existe
    const existingFactoring = await FactoringModel.getById(id);
    if (!existingFactoring) {
      return res.status(404).json({
        success: false,
        message: 'Factoring no encontrado'
      });
    }

    // Validar que la entidad de factoring existe (si se está actualizando)
    if (updateData.factoring_entities_id) {
      const entity = await FactoringEntityModel.getById(updateData.factoring_entities_id);
      if (!entity) {
        return res.status(400).json({
          success: false,
          message: 'Entidad de factoring no encontrada'
        });
      }
    }

    // Validar que el centro de costo existe (si se está actualizando)
    if (updateData.cost_center_id) {
      const costCenter = await ProjectModel.getById(updateData.cost_center_id);
      if (!costCenter) {
        return res.status(400).json({
          success: false,
          message: 'Centro de costo no encontrado'
        });
      }
    }

    const updatedFactoring = await FactoringModel.update(id, updateData);

    res.status(200).json({
      success: true,
      message: 'Factoring actualizado exitosamente',
      data: updatedFactoring
    });
  } catch (error) {
    console.error('Error in updateFactoring:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Elimina un factoring
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const deleteFactoring = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el factoring existe
    const existingFactoring = await FactoringModel.getById(id);
    if (!existingFactoring) {
      return res.status(404).json({
        success: false,
        message: 'Factoring no encontrado'
      });
    }

    await FactoringModel.delete(id);

    res.status(204).json();
  } catch (error) {
    console.error('Error in deleteFactoring:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtiene los montos totales de factorings según los filtros, desglosados por estado
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getFactoringTotalAmount = async (req, res) => {
  try {
    const { 
      status, 
      factoring_entities_id, 
      cost_center_id,
      date_from,
      date_to
    } = req.query;
    
    console.log('📥 getFactoringTotalAmount - Request params:', { 
      status, 
      factoring_entities_id, 
      cost_center_id,
      date_from,
      date_to
    });
    
    // Crear objeto de filtros
    const filters = {};
    if (status) filters.status = status;
    if (factoring_entities_id) filters.factoring_entities_id = parseInt(factoring_entities_id);
    if (cost_center_id) filters.cost_center_id = parseInt(cost_center_id);
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    
    const totals = await FactoringModel.getTotalAmounts(filters);
    
    console.log('📤 getFactoringTotalAmount - Totals:', totals);
    
    res.status(200).json({
      success: true,
      data: totals
    });
  } catch (error) {
    console.error('Error in getFactoringTotalAmount:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};