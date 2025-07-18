import { pool } from '../config/database.mjs';

/**
 * Modelo de Hitos para gestionar las operaciones relacionadas con hitos de proyectos
 */
export default {
  /**
   * Crea un nuevo hito para un proyecto
   * @param {Object} milestoneData - Datos del hito
   * @returns {Promise<Object>} Hito creado
   */
  async create(milestoneData) {
    try {
      // Insertar hito
      const [result] = await pool.query(
        `INSERT INTO construction_milestones 
         (cost_center_id, name, description, planned_date, amount, weight, sequence) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          milestoneData.cost_center_id,
          milestoneData.name,
          milestoneData.description || null,
          milestoneData.planned_date,
          milestoneData.amount || null,
          milestoneData.weight || 10.00,
          milestoneData.sequence || 10
        ]
      );
      
      // Obtener el hito creado
      const [milestones] = await pool.query(
        'SELECT * FROM construction_milestones WHERE id = ?',
        [result.insertId]
      );
      
      return milestones[0];
    } catch (error) {
      console.error('Error en create:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene un hito por su ID
   * @param {number} id - ID del hito
   * @returns {Promise<Object|null>} Datos del hito o null si no existe
   */
  async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM construction_milestones WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error en getById:', error.message);
      throw error;
    }
  },

  /**
   * Actualiza un hito existente
   * @param {number} id - ID del hito a actualizar
   * @param {Object} milestoneData - Datos a actualizar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async update(id, milestoneData) {
    try {
      const fields = [];
      const values = [];
      
      // Construir consulta dinámica con solo los campos a actualizar
      const updateableFields = [
        'name', 'description', 'planned_date', 'actual_date', 'amount', 
        'weight', 'is_completed', 'sequence'
      ];
      
      updateableFields.forEach(field => {
        if (milestoneData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(milestoneData[field]);
        }
      });
      
      // Si no hay campos para actualizar, retornar
      if (fields.length === 0) {
        return false;
      }
      
      // Añadir ID al final de los parámetros
      values.push(id);
      
      // Ejecutar actualización
      const [result] = await pool.query(
        `UPDATE construction_milestones SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en update:', error.message);
      throw error;
    }
  },

  /**
   * Elimina un hito
   * @param {number} id - ID del hito a eliminar
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM construction_milestones WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en delete:', error.message);
      throw error;
    }
  },

  /**
   * Marca un hito como completado
   * @param {number} id - ID del hito
   * @param {Date} [completionDate] - Fecha de completado, por defecto la fecha actual
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async markAsCompleted(id, completionDate = new Date()) {
    try {
      const [result] = await pool.query(
        'UPDATE construction_milestones SET is_completed = TRUE, actual_date = ? WHERE id = ?',
        [completionDate, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error en markAsCompleted:', error.message);
      throw error;
    }
  },

  /**
   * Lista los hitos de un proyecto
   * @param {number} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de hitos
   */
  async listByProject(projectId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM construction_milestones WHERE cost_center_id = ? ORDER BY sequence ASC, planned_date ASC',
        [projectId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error en listByProject:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene el progreso de hitos de un proyecto
   * @param {number} projectId - ID del proyecto
   * @returns {Promise<Object>} Datos de progreso
   */
  async getProjectProgress(projectId) {
    try {
      // Obtener todos los hitos del proyecto
      const [milestones] = await pool.query(
        'SELECT id, name, weight, is_completed FROM construction_milestones WHERE cost_center_id = ?',
        [projectId]
      );
      
      if (milestones.length === 0) {
        return {
          totalMilestones: 0,
          completedMilestones: 0,
          totalWeight: 0,
          completedWeight: 0,
          progressPercentage: 0
        };
      }
      
      // Calcular progreso
      let totalWeight = 0;
      let completedWeight = 0;
      let completedCount = 0;
      
      milestones.forEach(milestone => {
        totalWeight += parseFloat(milestone.weight || 0);
        
        if (milestone.is_completed) {
          completedWeight += parseFloat(milestone.weight || 0);
          completedCount++;
        }
      });
      
      // Calcular porcentaje de progreso
      const progressPercentage = totalWeight > 0 
        ? (completedWeight / totalWeight) * 100 
        : 0;
      
      return {
        totalMilestones: milestones.length,
        completedMilestones: completedCount,
        totalWeight,
        completedWeight,
        progressPercentage
      };
    } catch (error) {
      console.error('Error en getProjectProgress:', error.message);
      throw error;
    }
  }
};