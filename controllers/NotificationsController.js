const db = require('../config/db');
const NotificationModel = require('../models/NotificationModel');

// GET /api/notifications
exports.listForUser = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const email = req.user?.email || null;
    const notifications = await NotificationModel.getNotificationsByUser(userId, email);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('listForUser notifications error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi.' });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id || null;
    const email = req.user?.email || null;

    const affected = await NotificationModel.markAsRead(id, userId, email);
    if (!affected) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('markRead notifications error', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
};

// POST /api/notifications/mark-all-read
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const email = req.user?.email || null;
    await NotificationModel.markAllAsRead(userId, email);
    return res.json({ success: true });
  } catch (err) {
    console.error('markAllRead notifications error', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
};
