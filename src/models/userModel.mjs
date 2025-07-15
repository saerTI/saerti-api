// src/models/userModel.mjs
import { pool } from '../config/database.mjs';
import bcrypt from 'bcrypt';

/**
 * Modelo de Usuario para gestionar las operaciones relacionadas con usuarios
 */
export default {
  /**
   * Obtiene un usuario por su ID
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, email, role, active, created_at, updated_at,
                position, location, address 
         FROM users WHERE id = ?`,
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
   */
  async getByEmail(email) {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, email, password, role, active, created_at, updated_at,
                position, location, address 
         FROM users WHERE email = ?`,
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
   */
  async create(userData) {
    try {
      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Insertar usuario
      const [result] = await pool.query(
        `INSERT INTO users (name, email, password, role, position, location, address) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userData.name, 
          userData.email, 
          hashedPassword, 
          userData.role || 'user',
          userData.position || null,
          userData.location || null,
          userData.address || null
        ]
      );
      
      // Devolver el usuario creado sin la contraseña
      return {
        id: result.insertId,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user',
        position: userData.position || null,
        location: userData.location || null,
        address: userData.address || null
      };
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza los datos de un usuario
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

      // Campos del perfil
      if (userData.position !== undefined) {
        updateFields.push('position = ?');
        queryParams.push(userData.position);
      }

      if (userData.location !== undefined) {
        updateFields.push('location = ?');
        queryParams.push(userData.location);
      }

      if (userData.address !== undefined) {
        updateFields.push('address = ?');
        queryParams.push(userData.address);
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
   * Lista todos los usuarios con paginación y filtros
   */
  async listAll(page = 1, limit = 20, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      const whereConditions = [];
      const queryParams = [];
      
      // Aplicar filtros
      if (filters.search) {
        whereConditions.push('(name LIKE ? OR email LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm);
      }
      
      if (filters.role) {
        whereConditions.push('role = ?');
        queryParams.push(filters.role);
      }
      
      if (filters.active !== undefined) {
        whereConditions.push('active = ?');
        queryParams.push(filters.active);
      }
      
      // Construir la cláusula WHERE
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Obtener usuarios
      const [rows] = await pool.query(
        `SELECT id, name, email, role, active, created_at, updated_at,
                position, location, address
         FROM users 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );
      
      // Obtener total de usuarios para la paginación
      const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        queryParams
      );
      
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
  },

  /**
   * Cuenta usuarios por rol
   */
  async countByRole(role) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS count FROM users WHERE role = ?',
        [role]
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error en countByRole:', error.message);
      throw error;
    }
  },

  /**
   * Cuenta usuarios activos por rol
   */
  async countActiveByRole(role) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS count FROM users WHERE role = ? AND active = TRUE',
        [role]
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error en countActiveByRole:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene estadísticas generales de usuarios
   */
  async getStats() {
    try {
      // Obtener conteos por rol
      const [roleStats] = await pool.query(`
        SELECT 
          role,
          COUNT(*) as total,
          COUNT(CASE WHEN active = TRUE THEN 1 END) as active,
          COUNT(CASE WHEN active = FALSE THEN 1 END) as inactive
        FROM users 
        GROUP BY role
      `);
      
      // Obtener estadísticas generales
      const [generalStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN active = TRUE THEN 1 END) as active_users,
          COUNT(CASE WHEN active = FALSE THEN 1 END) as inactive_users,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_last_month
        FROM users
      `);
      
      // Obtener usuarios recientes
      const [recentUsers] = await pool.query(`
        SELECT id, name, email, role, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      return {
        byRole: roleStats,
        general: generalStats[0],
        recentUsers
      };
    } catch (error) {
      console.error('Error en getStats:', error.message);
      throw error;
    }
  },

  /**
   * Verifica si un usuario tiene un rol específico
   */
  async hasRole(userId, role) {
    try {
      const [rows] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND role = ? AND active = TRUE',
        [userId, role]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error en hasRole:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene todos los usuarios con un rol específico
   */
  async getByRole(role, activeOnly = true) {
    try {
      let query = `SELECT id, name, email, role, active, created_at,
                          position, location, address
                   FROM users WHERE role = ?`;
      const params = [role];
      
      if (activeOnly) {
        query += ' AND active = TRUE';
      }
      
      query += ' ORDER BY name';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error en getByRole:', error.message);
      throw error;
    }
  }
};