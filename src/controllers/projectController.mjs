import { validationResult } from 'express-validator';
import projectModel from '../models/projectModel.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Mapea estados de inglés a español para la base de datos
 */
function mapStatusToSpanish(status) {
  const statusMap = {
    'draft': 'borrador',
    'active': 'activo',
    'in_progress': 'en_progreso',
    'suspended': 'suspendido',
    'completed': 'completado',
    'cancelled': 'cancelado',
    'canceled': 'cancelado' // Variante americana
  };
  
  // Si ya está en español, devolverlo tal como está
  const spanishValues = ['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado'];
  if (spanishValues.includes(status)) {
    return status;
  }
  
  // Mapear de inglés a español
  return statusMap[status] || 'borrador'; // Default a 'borrador' si no se encuentra
}

/**
 * Mapea campos de camelCase (frontend) a snake_case (backend)
 */
function mapFieldsToBackend(frontendData) {
  return {
    name: frontendData.name,
    code: frontendData.code,
    description: frontendData.description,
    
    // Mapeo de campos de formato
    client_id: frontendData.clientId || frontendData.client_id,
    client: frontendData.client,
    start_date: frontendData.startDate || frontendData.start_date,
    expected_end_date: frontendData.expectedEndDate || frontendData.expected_end_date,
    actual_end_date: frontendData.actualEndDate || frontendData.actual_end_date,
    total_budget: frontendData.totalBudget || frontendData.total_budget || frontendData.budget,
    
    // Ubicación
    location: frontendData.location,
    location_lat: frontendData.locationLat || frontendData.location_lat,
    location_lon: frontendData.locationLon || frontendData.location_lon,
    address: frontendData.address,
    
    // ✅ ESTADO: aceptar tanto inglés como español
    status: mapStatusToSpanish(frontendData.status || 'draft')
  };
}

/**
 * Mapea campos de snake_case (backend) a camelCase (frontend)
 */
function mapFieldsToFrontend(backendData) {
  if (!backendData) return null;
  
  return {
    id: backendData.id,
    name: backendData.name,
    code: backendData.code,
    description: backendData.description,
    
    // Mapeo de campos de formato
    clientId: backendData.client_id,
    client: backendData.client,
    startDate: backendData.start_date,
    expectedEndDate: backendData.expected_end_date,
    actualEndDate: backendData.actual_end_date,
    totalBudget: backendData.total_budget,
    
    // Ubicación
    location: backendData.location,
    locationLat: backendData.location_lat,
    locationLon: backendData.location_lon,
    address: backendData.address,
    
    // Estado se mantiene en español
    status: backendData.status,
    
    // Metadatos
    ownerId: backendData.owner_id,
    createdAt: backendData.created_at,
    updatedAt: backendData.updated_at
  };
}

/**
 * Controlador para gestión de proyectos de construcción
 */
export default {
  /**
   * Crea un nuevo proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createProject(req, res, next) {
    try {
      console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
      console.log('👤 User:', { id: req.user.id, role: req.user.role });
      
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      // Mapear campos del frontend al formato del backend
      const mappedData = mapFieldsToBackend(req.body);
      console.log('🔄 Mapped data:', JSON.stringify(mappedData, null, 2));
      
      // Establecer al usuario actual como propietario
      const projectData = {
        ...mappedData,
        owner_id: req.user.id
      };
      
      console.log('📝 Final project data:', JSON.stringify(projectData, null, 2));
      
      // Validaciones adicionales
      if (!projectData.name || projectData.name.trim() === '') {
        console.log('❌ Name validation failed');
        return res.status(400).json({
          success: false,
          message: 'El nombre del proyecto es obligatorio'
        });
      }
      
      if (!projectData.code || projectData.code.trim() === '') {
        console.log('❌ Code validation failed');
        return res.status(400).json({
          success: false,
          message: 'El código del proyecto es obligatorio'
        });
      }
      
      // Verificar si el código ya existe
      try {
        const existingProject = await projectModel.getByCode ? 
          await projectModel.getByCode(projectData.code) : null;
        
        if (existingProject) {
          console.log('❌ Code already exists:', projectData.code);
          return res.status(409).json({
            success: false,
            message: 'Ya existe un proyecto con ese código'
          });
        }
      } catch (codeCheckError) {
        console.log('⚠️ Could not check for duplicate code:', codeCheckError.message);
        // Continuar, el error de duplicado se manejará en la creación
      }
      
      console.log('🚀 Creating project...');
      const project = await projectModel.create(projectData);
      console.log('✅ Project created successfully:', project.id);
      
      // ✅ MAPEAR RESPUESTA AL FORMATO FRONTEND
      const responseProject = mapFieldsToFrontend(project);
      
      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        data: responseProject
      });
    } catch (error) {
      console.error('❌ Error in createProject:');
      console.error('  Message:', error.message);
      console.error('  Code:', error.code);
      console.error('  Stack:', error.stack);
      
      // Manejar errores específicos de MySQL
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un proyecto con ese código'
        });
      }
      
      if (error.code === 'ER_BAD_NULL_ERROR') {
        const fieldMatch = error.message.match(/Column '(.+?)' cannot be null/);
        const field = fieldMatch ? fieldMatch[1] : 'unknown';
        return res.status(400).json({
          success: false,
          message: `El campo '${field}' es obligatorio`
        });
      }
      
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
          success: false,
          message: 'El cliente especificado no existe'
        });
      }
      
      if (error.code === 'WARN_DATA_TRUNCATED' || error.message.includes('Data truncated')) {
        return res.status(400).json({
          success: false,
          message: 'Uno de los valores proporcionados no es válido (posiblemente el estado)'
        });
      }
      
      // Error genérico
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Obtiene la lista de proyectos con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjects(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20,
        status,
        search,
        start_date_from,
        start_date_to
      } = req.query;
      
      // Construir filtros
      const filters = {};
      
      // Si no es admin, solo mostrar proyectos del usuario
      if (req.user.role !== 'admin') {
        filters.owner_id = req.user.id;
      }
      
      // Aplicar filtros adicionales (mapear estado si es necesario)
      if (status) {
        filters.status = mapStatusToSpanish(status);
      }
      if (search) filters.search = search;
      if (start_date_from) filters.start_date_from = start_date_from;
      if (start_date_to) filters.start_date_to = start_date_to;
      
      const projects = await projectModel.listProjects(filters, page, limit);
      
      // ✅ MAPEAR TODOS LOS PROYECTOS AL FORMATO FRONTEND
      const mappedProjects = {
        ...projects,
        data: projects.data.map(project => mapFieldsToFrontend(project))
      };
      
      res.json({
        success: true,
        data: mappedProjects.data,
        pagination: mappedProjects.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene un proyecto por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectById(req, res, next) {
    try {
      const { id } = req.params;
      
      const project = await projectModel.getById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este proyecto'
        });
      }
      
      // ✅ MAPEAR PROYECTO AL FORMATO FRONTEND
      const responseProject = mapFieldsToFrontend(project);
      
      res.json({
        success: true,
        data: responseProject
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza un proyecto existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateProject(req, res, next) {
    try {
      console.log('📥 Update request body:', JSON.stringify(req.body, null, 2));
      
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Update validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este proyecto'
        });
      }
      
      // Mapear campos del frontend al backend
      const updateData = mapFieldsToBackend(req.body);
      console.log('🔄 Mapped update data:', JSON.stringify(updateData, null, 2));
      
      // Actualizar proyecto
      const updated = await projectModel.update(id, updateData);
      
      // Obtener proyecto actualizado
      const updatedProject = await projectModel.getById(id);
      
      // ✅ MAPEAR PROYECTO ACTUALIZADO AL FORMATO FRONTEND
      const responseProject = mapFieldsToFrontend(updatedProject);
      
      res.json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        data: responseProject
      });
    } catch (error) {
      console.error('❌ Error in updateProject:', error);
      next(error);
    }
  },

  /**
   * Elimina un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteProject(req, res, next) {
    try {
      const { id } = req.params;
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este proyecto'
        });
      }
      
      // Eliminar proyecto
      await projectModel.delete(id);
      
      res.json({
        success: true,
        message: 'Proyecto eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualiza el estado de un proyecto
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateProjectStatus(req, res, next) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Error de validación',
          errors: errors.array()
        });
      }
      
      const { id } = req.params;
      const { status } = req.body;
      
      // Mapear estado a español
      const mappedStatus = mapStatusToSpanish(status);
      
      // Validar estado mapeado
      const validStatuses = ['borrador', 'activo', 'en_progreso', 'suspendido', 'completado', 'cancelado'];
      if (!validStatuses.includes(mappedStatus)) {
        return res.status(400).json({
          success: false,
          message: `Estado no válido. Estados permitidos: ${validStatuses.join(', ')}`
        });
      }
      
      // Verificar si el proyecto existe
      const existingProject = await projectModel.getById(id);
      
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado'
        });
      }
      
      // Verificar permisos de acceso
      if (req.user.role !== 'admin' && existingProject.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este proyecto'
        });
      }
      
      // Actualizar estado
      await projectModel.updateStatus(id, mappedStatus);
      
      // Obtener proyecto actualizado
      const updatedProject = await projectModel.getById(id);
      
      // ✅ MAPEAR PROYECTO ACTUALIZADO AL FORMATO FRONTEND
      const responseProject = mapFieldsToFrontend(updatedProject);
      
      res.json({
        success: true,
        message: `Estado del proyecto actualizado a ${mappedStatus}`,
        data: responseProject
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Obtiene el resumen de estados de todos los proyectos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async getProjectStatusSummary(req, res, next) {
    try {
      const summary = await projectModel.getProjectStatusSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
};