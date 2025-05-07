// src/models/companyUsersModel.mjs
import { pool } from '../config/database.mjs';
import bcrypt from 'bcrypt';
import { AppError } from '../middleware/errorHandler.mjs';

/**
 * Modelo para gestión de usuarios por compañía
 */
export default {
  /**
   * Crear un nuevo usuario para una compañía
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} - Usuario creado (sin contraseña)
   */
  async create(userData) {
    const { name, email, password, role, company_id, position } = userData;
    
    try {
      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insertar usuario
      const [result] = await pool.execute(
        `INSERT INTO users 
         (name, email, password, role, company_id, position) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, role || 'user', company_id || null, position || null]
      );
      
      if (result.affectedRows === 0) {
        throw new AppError('Error al crear el usuario', 500);
      }
      
      // Obtener usuario creado (sin contraseña)
      return this.getById(result.insertId);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new AppError('El email ya está en uso', 409);
      }
      throw error;
    }
  },
  
  /**
   * Obtener un usuario por ID
   * @param {number} id - ID del usuario
   * @returns {Promise<Object|null>} - Usuario o null si no existe
   */
  async getById(id) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.position, u.company_id, 
              c.name as company_name, u.active, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN construction_projects c ON u.company_id = c.id
       WHERE u.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  },
  
  /**
   * Listar usuarios por compañía
   * @param {number} companyId - ID de la compañía
   * @param {number} page - Número de página
   * @param {number} limit - Elementos por página
   * @param {Object} filters - Filtros adicionales
   * @returns {Promise<Object>} - Lista de usuarios y metadatos de paginación
   */
  async listByCompany(companyId, page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const whereConditions = ['u.company_id = ?'];
    const queryParams = [companyId];
    
    // Aplicar filtros adicionales
    if (filters.role) {
      whereConditions.push('u.role = ?');
      queryParams.push(filters.role);
    }
    
    if (filters.active !== undefined) {
      whereConditions.push('u.active = ?');
      queryParams.push(filters.active);
    }
    
    if (filters.search) {
      whereConditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Consulta para obtener usuarios
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.role, u.position, u.company_id, 
              c.name as company_name, u.active, u.created_at
       FROM users u
       LEFT JOIN construction_projects c ON u.company_id = c.id
       ${whereClause}
       ORDER BY u.name
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );
    
    // Consulta para obtener el total de usuarios (para paginación)
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM users u
       LEFT JOIN construction_projects c ON u.company_id = c.id
       ${whereClause}`,
      queryParams
    );
    
    const total = countResult[0].total;
    
    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },
  
  /**
   * Verificar si un usuario pertenece a una compañía
   * @param {number} userId - ID del usuario
   * @param {number} companyId - ID de la compañía
   * @returns {Promise<boolean>} - True si el usuario pertenece a la compañía
   */
  async belongsToCompany(userId, companyId) {
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND company_id = ?',
      [userId, companyId]
    );
    
    return rows.length > 0;
  },
  
  /**
   * Actualizar un usuario
   * @param {number} id - ID del usuario
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<boolean>} - True si la actualización fue exitosa
   */
  async update(id, updateData) {
    const allowedFields = ['name', 'email', 'role', 'active', 'company_id', 'position'];
    const updates = [];
    const values = [];
    
    // Manejar contraseña si existe
    if (updateData.password) {
      updates.push('password = ?');
      values.push(await bcrypt.hash(updateData.password, 10));
    }
    
    // Construir consulta dinámica para otros campos
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) {
      return true; // Nada que actualizar
    }
    
    // Añadir id para WHERE
    values.push(id);
    
    // Ejecutar la actualización
    const [result] = await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return result.affectedRows > 0;
  },
  
  /**
   * Eliminar un usuario
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} - True si la eliminación fue exitosa
   */
  async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  },
  
  /**
   * Verificar si un usuario es administrador de una compañía
   * @param {number} userId - ID del usuario
   * @param {number} companyId - ID de la compañía
   * @returns {Promise<boolean>} - True si el usuario es admin de la compañía
   */
  async isCompanyAdmin(userId, companyId) {
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND company_id = ? AND role = ?',
      [userId, companyId, 'admin']
    );
    
    return rows.length > 0;
  },
  
  /**
   * Asignar un usuario a una compañía
   * @param {number} userId - ID del usuario
   * @param {number} companyId - ID de la compañía
   * @param {string} position - Posición del usuario en la compañía
   * @returns {Promise<boolean>} - True si la asignación fue exitosa
   */
  async assignToCompany(userId, companyId, position = null) {
    const [result] = await pool.execute(
      'UPDATE users SET company_id = ?, position = ? WHERE id = ?',
      [companyId, position, userId]
    );
    
    return result.affectedRows > 0;
  },
  
  /**
   * Desasignar un usuario de una compañía
   * @param {number} userId - ID del usuario
   * @returns {Promise<boolean>} - True si la desasignación fue exitosa
   */
  async removeFromCompany(userId) {
    const [result] = await pool.execute(
      'UPDATE users SET company_id = NULL, position = NULL WHERE id = ?',
      [userId]
    );
    
    return result.affectedRows > 0;
  }
};