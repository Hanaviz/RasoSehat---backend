// RasoSehat-Backend/models/AdminUserModel.js
// Model untuk admin manage users (tidak berhubungan dengan user profile biasa)

const db = require('../config/db');

const AdminUserModel = {
  /**
   * Fetch all users dengan pagination & search
   * @param {Object} options - { search, limit, offset }
   * @returns {Array} users
   */
  async getAllUsers({ search = '', limit = 50, offset = 0 } = {}) {
    try {
      let query = `
        SELECT 
          id, name, email, phone, role, avatar, created_at, birth_date, gender
        FROM users
      `;
      const params = [];

      if (search && search.trim()) {
        query += ` WHERE name LIKE ? OR email LIKE ?`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const [rows] = await db.execute(query, params);
      return rows || [];
    } catch (err) {
      throw err;
    }
  },

  /**
   * Get total user count (for pagination)
   * @param {string} search - optional search term
   * @returns {number} total count
   */
  async getUserCount(search = '') {
    try {
      let query = `SELECT COUNT(*) as total FROM users`;
      const params = [];

      if (search && search.trim()) {
        query += ` WHERE name LIKE ? OR email LIKE ?`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      const [rows] = await db.execute(query, params);
      return rows[0] ? rows[0].total : 0;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Get single user by ID
   * @param {number} userId
   * @returns {Object} user record
   */
  async getUserById(userId) {
    try {
      const [rows] = await db.execute(
        `SELECT id, name, email, phone, role, avatar, birth_date, gender, created_at 
         FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      return rows[0] || null;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Update user role
   * @param {number} userId
   * @param {string} newRole - 'admin', 'penjual', 'pembeli'
   * @returns {Object} updated user record
   */
  async updateUserRole(userId, newRole) {
    try {
      // Validate role value
      const validRoles = ['admin', 'penjual', 'pembeli'];
      if (!validRoles.includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      const [result] = await db.execute(
        `UPDATE users SET role = ? WHERE id = ?`,
        [newRole, userId]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      // Return updated user record
      return await this.getUserById(userId);
    } catch (err) {
      throw err;
    }
  },

  /**
   * Check if user has restaurants
   * @param {number} userId
   * @returns {number} count of restaurants
   */
  async getUserRestaurantCount(userId) {
    try {
      const [rows] = await db.execute(
        `SELECT COUNT(*) as count FROM restorans WHERE user_id = ?`,
        [userId]
      );
      return rows[0] ? rows[0].count : 0;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Delete user by ID
   * @param {number} userId
   * @returns {boolean} true if deleted successfully
   */
  async deleteUser(userId) {
    try {
      // Use a dedicated connection and proper transaction APIs (mysql2/promise)
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // Set user_id = NULL for related restaurants instead of cascading delete
        console.log('[AdminUserModel] deleteUser: running UPDATE restorans');
        await conn.query(
          `UPDATE restorans SET user_id = NULL WHERE user_id = ?`,
          [userId]
        );

        // Delete the user
        console.log('[AdminUserModel] deleteUser: running DELETE users');
        const [result] = await conn.query(
          `DELETE FROM users WHERE id = ?`,
          [userId]
        );

        if (result.affectedRows === 0) {
          await conn.rollback();
          conn.release();
          return false;
        }

        await conn.commit();
        conn.release();
        return true;
      } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
      }
    } catch (err) {
      throw err;
    }
  }
};

module.exports = AdminUserModel;
