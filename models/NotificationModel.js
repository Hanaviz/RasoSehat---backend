const supabase = require('../supabase/supabaseClient');

/**
 * NotificationModel (Supabase-backed)
 */
const NotificationModel = {
  /**
   * Create a notification.
   * data will be JSON.stringified when present.
   * Returns inserted record id.
   */
  async createNotification({ user_id = null, recipient_email = null, type = null, title = '', message = '', data = null }) {
    try {
      const payload = data ? JSON.stringify(data) : null;
      const insert = {
        user_id: user_id || null,
        recipient_email: recipient_email || null,
        type: type || null,
        title: title || '',
        message: message || '',
        data: payload,
        created_at: new Date().toISOString(),
      };
      const { data: inserted, error } = await supabase.from('notifications').insert(insert).select('id').limit(1).single();
      if (error) throw error;
      return inserted?.id ?? null;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Fetch notifications for a user by user_id or recipient_email.
   * Returns array of normalized notifications with parsed data and boolean is_read.
   */
  async getNotificationsByUser(user_id = null, recipient_email = null, limit = 200) {
    try {
      // Build query conditionally to avoid matching nulls incorrectly
      let query = supabase.from('notifications').select('id,user_id,recipient_email,type,title,message,data,is_read,created_at').order('created_at', { ascending: false }).limit(Number(limit || 200));
      if (user_id && recipient_email) {
        query = query.or(`user_id.eq.${user_id},recipient_email.eq.${recipient_email}`);
      } else if (user_id) {
        query = query.eq('user_id', user_id);
      } else if (recipient_email) {
        query = query.eq('recipient_email', recipient_email);
      } else {
        // no filters -> return empty to avoid exposing all notifications
        return [];
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      return (rows || []).map(r => {
        let parsed = null;
        try {
          parsed = r.data ? (typeof r.data === 'object' ? r.data : JSON.parse(r.data)) : null;
        } catch (e) {
          parsed = null;
        }

        return {
          id: r.id,
          user_id: r.user_id,
          recipient_email: r.recipient_email,
          type: r.type,
          title: r.title,
          message: r.message,
          data: parsed,
          is_read: r.is_read === 1 || r.is_read === true,
          created_at: r.created_at,
        };
      });
    } catch (err) {
      throw err;
    }
  },

  /**
   * Mark single notification as read by id.
   * If `user_id` or `recipient_email` are provided, the update will include ownership checks.
   * Returns rowCount (number).
   */
  async markAsRead(id, user_id = null, recipient_email = null) {
    try {
      if (!id) return 0;
      // Fetch the notification to perform ownership check
      const { data: existing, error: fetchErr } = await supabase.from('notifications').select('id,user_id,recipient_email').eq('id', id).limit(1).single();
      if (fetchErr) throw fetchErr;
      if (!existing) return 0;
      if (user_id || recipient_email) {
        if ((user_id && existing.user_id !== user_id) && (recipient_email && existing.recipient_email !== recipient_email)) {
          return 0;
        }
      }
      const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select('id');
      if (error) throw error;
      return data ? 1 : 0;
    } catch (err) {
      throw err;
    }
  },
    /**
     * Mark single notification as read by id.
     * Returns rowCount (number).
   */
  async markAllAsRead(user_id = null, recipient_email = null) {
    try {
      if (!user_id && !recipient_email) return 0;
      let query = supabase.from('notifications');
      if (user_id && recipient_email) {
        query = query.or(`user_id.eq.${user_id},recipient_email.eq.${recipient_email}`);
      } else if (user_id) {
        query = query.eq('user_id', user_id);
      } else if (recipient_email) {
        query = query.eq('recipient_email', recipient_email);
      }
      const { data, error } = await query.update({ is_read: true }).select('id');
      if (error) throw error;
      return Array.isArray(data) ? data.length : (data ? 1 : 0);
    } catch (err) {
      throw err;
    }
  }
};

module.exports = NotificationModel;
