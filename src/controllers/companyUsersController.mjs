// src/controllers/companyUsersController.mjs
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { pool } from '../config/database.mjs';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Controlador para gestión de usuarios por compañía
 */
export default {
  /**
   * Crear un nuevo usuario para una compañía
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async createCompanyUser(req, res, next) {
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
      
      const { name, email, password, role, position, company_id } = req.body;
      
      // Verificar si se proporciona una compañía
      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: 'Debe especificar una compañía para el usuario'
        });
      }
      
      // Verificar si la compañía existe
      const [companies] = await pool.query(
        'SELECT * FROM construction_projects WHERE id = ?',
        [company_id]
      );
      
      if (companies.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'La compañía/proyecto especificada no existe'
        });
      }
      
      // Verificar permisos (solo admin general o admin de la misma compañía)
      const isCompanyAdmin = req.user.role === 'admin' && req.user.company_id === Number(company_id);
      const isSuperAdmin = req.user.role === 'admin' && !req.user.company_id;
      
      if (!isCompanyAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear usuarios en esta compañía'
        });
      }
      
      // Verificar si el email ya está en uso
      const [existingUsers] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'El correo electrónico ya está registrado'
        });
      }
      
      // Validar rol (admin de compañía solo puede crear usuarios regulares)
      if ((role === 'admin' || role === 'manager') && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores globales pueden crear administradores o managers'
        });
      }
      
      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Crear usuario
      const [result] = await pool.execute(
        `INSERT INTO users 
         (name, email, password, role, company_id, position) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, role || 'user', company_id, position || null]
      );
      
      // Obtener usuario creado (sin contraseña)
      const [users] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.position, u.company_id, 
                c.name as company_name, u.created_at, u.active
         FROM users u
         LEFT JOIN construction_projects c ON u.company_id = c.id
         WHERE u.id = ?`,
        [result.insertId]
      );
      
      const user = users[0];
      
      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Listar usuarios de una compañía
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async listCompanyUsers(req, res, next) {
    try {
      const { company_id } = req.params;
      const { page = 1, limit = 20, search } = req.query;
      
      // Verificar permisos (solo admin general o admin de la misma compañía)
      const isCompanyAdmin = req.user.role === 'admin' && req.user.company_id === Number(company_id);
      const isSuperAdmin = req.user.role === 'admin' && !req.user.company_id;
      
      if (!isCompanyAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver usuarios de esta compañía'
        });
      }
      
      // Construir consulta base
      let query = `
        SELECT u.id, u.name, u.email, u.role, u.position, u.company_id, 
               c.name as company_name, u.created_at, u.active
        FROM users u
        LEFT JOIN construction_projects c ON u.company_id = c.id
        WHERE u.company_id = ?
      `;
      
      const queryParams = [company_id];
      
      // Añadir búsqueda si se proporciona
      if (search) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }
      
      // Añadir ordenamiento y paginación
      query += ` ORDER BY u.name
                 LIMIT ? OFFSET ?`;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      queryParams.push(parseInt(limit), offset);
      
      // Ejecutar consulta
      const [users] = await pool.query(query, queryParams);
      
      // Obtener total para paginación
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.company_id = ?
        ${search ? `AND (u.name LIKE ? OR u.email LIKE ?)` : ''}
      `;
      
      const countParams = [company_id];
      if (search) {
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm);
      }
      
      const [countResult] = await pool.query(countQuery, countParams);
      const total = countResult[0].total;
      
      res.json({
        success: true,
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Actualizar un usuario de compañía
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async updateCompanyUser(req, res, next) {
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
      const { name, email, password, role, position, active } = req.body;
      
      // Obtener usuario actual
      const [existingUsers] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      if (existingUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      const existingUser = existingUsers[0];
      
      // Verificar permisos (solo admin general o admin de la misma compañía)
      const isCompanyAdmin = req.user.role === 'admin' && req.user.company_id === existingUser.company_id;
      const isSuperAdmin = req.user.role === 'admin' && !req.user.company_id;
      
      if (!isCompanyAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar este usuario'
        });
      }
      
      // Validar rol (admin de compañía no puede cambiar roles a admin)
      if (role && role !== existingUser.role && role === 'admin' && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores globales pueden asignar rol de administrador'
        });
      }
      
      // Verificar email único si se cambia
      if (email && email !== existingUser.email) {
        const [usersWithEmail] = await pool.query(
          'SELECT * FROM users WHERE email = ? AND id != ?',
          [email, id]
        );
        
        if (usersWithEmail.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'El correo electrónico ya está en uso'
          });
        }
      }
      
      // Construir consulta dinámica
      const updates = [];
      const values = [];
      
      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      
      if (email) {
        updates.push('email = ?');
        values.push(email);
      }
      
      if (password) {
        updates.push('password = ?');
        values.push(await bcrypt.hash(password, 10));
      }
      
      if (role) {
        updates.push('role = ?');
        values.push(role);
      }
      
      if (position) {
        updates.push('position = ?');
        values.push(position);
      }
      
      if (active !== undefined) {
        updates.push('active = ?');
        values.push(active);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionaron datos para actualizar'
        });
      }
      
      // Añadir id para WHERE
      values.push(id);
      
      // Ejecutar actualización
      await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      // Obtener usuario actualizado
      const [updatedUsers] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.position, u.company_id, 
                c.name as company_name, u.created_at, u.active
         FROM users u
         LEFT JOIN construction_projects c ON u.company_id = c.id
         WHERE u.id = ?`,
        [id]
      );
      
      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: updatedUsers[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Eliminar un usuario de compañía
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función next de Express
   * @returns {Promise<void>}
   */
  async deleteCompanyUser(req, res, next) {
    try {
      const { id } = req.params;
      
      // No permitir eliminar al propio usuario
      if (id === req.user.id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propia cuenta'
        });
      }
      
      // Obtener usuario a eliminar
      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      
      const userToDelete = users[0];
      
      // Verificar permisos (solo admin general o admin de la misma compañía)
      const isCompanyAdmin = req.user.role === 'admin' && req.user.company_id === userToDelete.company_id;
      const isSuperAdmin = req.user.role === 'admin' && !req.user.company_id;
      
      if (!isCompanyAdmin && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para eliminar este usuario'
        });
      }
      
      // No permitir que admin de compañía elimine a otro admin
      if (isCompanyAdmin && userToDelete.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No puedes eliminar a otro administrador'
        });
      }
      
      // Eliminar usuario
      await pool.query(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
};