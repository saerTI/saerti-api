// src/models/factoringEntityModel.mjs
import { pool } from '../config/database.mjs';

/**
 * Modelo de Entidad de Factoring para gestionar las operaciones relacionadas con entidades de factoring
 */
export default {
  /**
   * Obtiene una entidad de factoring por su ID
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, name FROM factoring_entities WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getById:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene una entidad de factoring por su nombre
   */
  async getByName(name) {
    try {
      const [rows] = await pool.query(
        'SELECT id, name FROM factoring_entities WHERE name = ?',
        [name]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getByName:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene todas las entidades de factoring
   */
  async getAll() {
    try {
      const [rows] = await pool.query(
        'SELECT id, name FROM factoring_entities ORDER BY name ASC'
      );
      return rows;
    } catch (error) {
      console.error('Error en getAll:', error.message);
      throw error;
    }
  },

  /**
   * Crea una nueva entidad de factoring
   */
  async create(entityData) {
    try {
      const { name } = entityData;

      // Verificar si ya existe una entidad con el mismo nombre
      const existing = await this.getByName(name);
      if (existing) {
        throw new Error('Ya existe una entidad de factoring con ese nombre');
      }

      const [result] = await pool.query(
        'INSERT INTO factoring_entities (name) VALUES (?)',
        [name]
      );

      return {
        id: result.insertId,
        name
      };
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza una entidad de factoring
   */
  async update(id, entityData) {
    try {
      const { name } = entityData;

      // Verificar si la entidad existe
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Entidad de factoring no encontrada');
      }

      // Verificar si el nuevo nombre ya existe (excluyendo la entidad actual)
      if (name !== existing.name) {
        const nameExists = await pool.query(
          'SELECT id FROM factoring_entities WHERE name = ? AND id != ?',
          [name, id]
        );
        if (nameExists[0].length > 0) {
          throw new Error('Ya existe una entidad de factoring con ese nombre');
        }
      }

      await pool.query(
        'UPDATE factoring_entities SET name = ? WHERE id = ?',
        [name, id]
      );

      return {
        id,
        name
      };
    } catch (error) {
      console.error('Error en update:', error.message);
      throw error;
    }
  },

  /**
   * Elimina una entidad de factoring
   */
  async delete(id) {
    try {
      // Verificar si la entidad existe
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Entidad de factoring no encontrada');
      }

      const [result] = await pool.query(
        'DELETE FROM factoring_entities WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete:', error.message);
      throw error;
    }
  },

  /**
   * Cuenta el número total de entidades de factoring
   */
  async count() {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM factoring_entities'
      );
      return rows[0].count;
    } catch (error) {
      console.error('Error en count:', error.message);
      throw error;
    }
  }
};