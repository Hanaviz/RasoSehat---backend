const db = require('../config/db');

/**
 * NotificationModel
 * Provides centralized DB operations for notifications table.
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
      const [result] = await db.execute(
        'INSERT INTO notifications (user_id, recipient_email, `type`, title, message, data, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user_id, recipient_email, type, title, message, payload]
      );
      return result.insertId || null;
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
      const [rows] = await db.execute(
        'SELECT id, user_id, recipient_email, `type`, title, message, data, is_read, created_at FROM notifications WHERE (user_id = ? OR recipient_email = ?) ORDER BY created_at DESC LIMIT ?',
        [user_id, recipient_email, Number(limit || 200)]
      );

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
   * Returns affectedRows (number).
   */
  /**
   * Mark single notification as read by id, but only if it belongs to the given user_id or recipient_email when provided.
   * If user_id/recipient_email are provided, the update will include ownership check.
   */
  async markAsRead(id, user_id = null, recipient_email = null) {
    try {
      if (user_id || recipient_email) {
        const [result] = await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR recipient_email = ?)', [id, user_id, recipient_email]);
        return result.affectedRows || 0;
      }
      const [result] = await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
      return result.affectedRows || 0;
    } catch (err) {
      throw err;
    }
  },

  /**
   * Mark all notifications as read for a user or recipient email.
   */
  async markAllAsRead(user_id = null, recipient_email = null) {
    try {
      const [result] = await db.execute('UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR recipient_email = ?)', [user_id, recipient_email]);
      return result.affectedRows || 0;
    } catch (err) {
      throw err;
    }
  }
};

module.exports = NotificationModel;
