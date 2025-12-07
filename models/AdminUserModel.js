// RasoSehat-Backend/models/AdminUserModel.js (Supabase-backed)

const supabase = require('../supabase/supabaseClient');

const AdminUserModel = {
  /**
   * Fetch all users dengan pagination & search
   * @param {Object} options - { search, limit, offset }
   * @returns {Array} users
   */
  async getAllUsers({ search = '', limit = 50, offset = 0 } = {}) {
    try {
      const q = supabase.from('users').select('id,name,email,phone,role,avatar,created_at,birth_date,gender');
      if (search && search.trim()) {
        const term = `%${search}%`;
        q.or(`name.ilike.${term},email.ilike.${term}`);
      }
      q.order('created_at', { ascending: false });
      const start = Number(offset || 0);
      const end = start + (Number(limit || 50) - 1);
      const { data, error } = await q.range(start, end);
      if (error) throw error;
      return data || [];
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
      const q = supabase.from('users').select('id', { count: 'exact' });
      if (search && search.trim()) {
        const term = `%${search}%`;
        q.or(`name.ilike.${term},email.ilike.${term}`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return Number(count ?? (data ? data.length : 0));
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
      const { data, error } = await supabase.from('users').select('id,name,email,phone,role,avatar,birth_date,gender,created_at').eq('id', userId).limit(1).single();
      if (error) throw error;
      return data || null;
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

      const { data, error } = await supabase.from('users').update({ role: newRole }).eq('id', userId).select('id');
      if (error) throw error;
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
      const { data, error, count } = await supabase.from('restorans').select('id', { count: 'exact' }).eq('user_id', userId);
      if (error) throw error;
      return Number(count ?? (data ? data.length : 0));
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
      // Supabase: perform sequence with best-effort rollback on failure
      const { data: restaurants, error: fetchErr } = await supabase.from('restorans').select('id').eq('user_id', userId);
      if (fetchErr) throw fetchErr;
      const restaurantIds = (restaurants || []).map(r => r.id);

      const { error: updateErr } = await supabase.from('restorans').update({ user_id: null }).eq('user_id', userId);
      if (updateErr) throw updateErr;

      const { data: delData, error: delErr } = await supabase.from('users').delete().eq('id', userId).select('id');
      if (delErr) {
        // rollback attempt
        try {
          if (restaurantIds.length) {
            await supabase.from('restorans').update({ user_id: userId }).in('id', restaurantIds);
          }
        } catch (e) {
          console.error('Failed rollback after delete error', e);
        }
        throw delErr;
      }
      return Array.isArray(delData) ? delData.length > 0 : !!delData;
    } catch (err) {
      throw err;
    }
  }
};

module.exports = AdminUserModel;
