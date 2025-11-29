const db = require('../config/db');

// GET /api/notifications
exports.listForUser = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const email = req.user?.email || null;

    const [rows] = await db.execute(
      'SELECT id, user_id, recipient_email, `type`, title, message, data, is_read, created_at FROM notifications WHERE (user_id = ? OR recipient_email = ?) ORDER BY created_at DESC LIMIT 200',
      [userId, email]
    );

    return res.json({ success: true, data: rows });
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

    const [result] = await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR recipient_email = ?)',
      [id, userId, email]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
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

    await db.execute('UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR recipient_email = ?)', [userId, email]);
    return res.json({ success: true });
  } catch (err) {
    console.error('markAllRead notifications error', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
};
