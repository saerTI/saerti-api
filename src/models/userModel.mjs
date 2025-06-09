import { pool } from '../config/database.mjs';
import bcrypt from 'bcrypt';

/**
 * Modelo de Usuario para gestionar las operaciones relacionadas con usuarios
 */
export default {
  /**
   * Obtiene un usuario por su ID
   * @param {number} id - ID del usuario
   * @returns {Promise<Object|null>} Datos del usuario o null si no existe
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getById:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene un usuario por su email
   * @param {string} email - Email del usuario
   * @returns {Promise<Object|null>} Datos del usuario o null si no existe
   */
  async getByEmail(email) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getByEmail:', error.message);
      throw error;
    }
  },

  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Usuario creado
   */
  async create(userData) {
    try {
      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Insertar usuario
      const [result] = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [userData.name, userData.email, hashedPassword, userData.role || 'user']
      );
      
      // Devolver el usuario creado sin la contraseña
      return {
        id: result.insertId,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user'
      };
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza los datos de un usuario
   * @param {number} id - ID del usuario a actualizar
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async update(id, userData) {
    try {
      const updateFields = [];
      const queryParams = [];
      
      // Construir consulta dinámica con solo los campos a actualizar
      if (userData.name) {
        updateFields.push('name = ?');
        queryParams.push(userData.name);
      }
      
      if (userData.email) {
        updateFields.push('email = ?');
        queryParams.push(userData.email);
      }
      
      if (userData.password) {
        updateFields.push('password = ?');
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        queryParams.push(hashedPassword);
      }
      
      if (userData.role) {
        updateFields.push('role = ?');
        queryParams.push(userData.role);
      }
      
      if (userData.active !== undefined) {
        updateFields.push('active = ?');
        queryParams.push(userData.active);
      }
      
      // Si no hay campos para actualizar, retornar
      if (updateFields.length === 0) {
        return false;
      }
      
      // Añadir ID al final de los parámetros
      queryParams.push(id);
      
      // Ejecutar actualización
      const [result] = await pool.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        queryParams
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en update:', error.message);
      throw error;
    }
  },

  /**
   * Elimina un usuario
   * @param {number} id - ID del usuario a eliminar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete:', error.message);
      throw error;
    }
  },

  /**
   * Verifica las credenciales de un usuario
   * @param {string} email - Email del usuario
   * @param {string} password - Contraseña a verificar
   * @returns {Promise<Object|null>} Usuario autenticado o null si las credenciales son inválidas
   */
  async authenticate(email, password) {
    try {
      // Obtener usuario por email
      const user = await this.getByEmail(email);
      
      // Verificar si el usuario existe y está activo
      if (!user || !user.active) {
        return null;
      }
      
      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return null;
      }
      
      // Devolver usuario autenticado sin la contraseña
      const { password: _, ...authenticatedUser } = user;
      return authenticatedUser;
    } catch (error) {
      console.error('Error en authenticate:', error.message);
      throw error;
    }
  },

  /**
   * Lista todos los usuarios con paginación
   * @param {number} page - Número de página
   * @param {number} limit - Límite de resultados por página
   * @returns {Promise<Object>} Lista de usuarios y metadatos de paginación
   */
  async listAll(page = 1, limit = 200) {
    try {
      const offset = (page - 1) * limit;
      
      // Obtener usuarios
      const [rows] = await pool.query(
        'SELECT id, name, email, role, active, created_at, updated_at FROM users LIMIT ? OFFSET ?',
        [parseInt(limit), parseInt(offset)]
      );
      
      // Obtener total de usuarios para la paginación
      const [countResult] = await pool.query('SELECT COUNT(*) AS total FROM users');
      const total = countResult[0].total;
      
      return {
        data: rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error en listAll:', error.message);
      throw error;
    }
  }
};