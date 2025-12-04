const db = require('../config/db');

/**
 * GET /api/seller/my-store
 * Return seller's restaurant, menus, menuStats and analytics (dummy)
 */
const getMyStore = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Fetch restaurant for this seller
    const [restRows] = await db.execute(
      `SELECT id, user_id, nama_restoran, slug, alamat, no_telepon, status_verifikasi, operating_hours, social_media, documents_json, created_at, updated_at
       FROM restorans WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const restaurant = restRows && restRows[0] ? restRows[0] : null;
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran penjual tidak ditemukan' });
    }

    // Fetch menus for this restaurant with kategori and average rating
    const menusQuery = `
      SELECT m.id, m.nama_menu, m.slug, m.harga, m.foto, m.status_verifikasi, m.kalori,
        k.nama_kategori as kategori,
        IFNULL(ROUND(AVG(u.rating),2), 0) as rating,
        COUNT(u.id) as rating_count,
        m.deskripsi
      FROM menu_makanan m
      LEFT JOIN kategori_makanan k ON m.kategori_id = k.id
      LEFT JOIN ulasan u ON u.menu_id = m.id
      WHERE m.restoran_id = ?
      GROUP BY m.id
      ORDER BY m.updated_at DESC
    `;
    const [menuRows] = await db.execute(menusQuery, [restaurant.id]);

    // menuStats
    const totalMenu = menuRows.length;
    const pending = menuRows.filter(m => m.status_verifikasi === 'pending').length;
    const approved = menuRows.filter(m => m.status_verifikasi === 'disetujui').length;
    const rejected = menuRows.filter(m => m.status_verifikasi === 'ditolak').length;

    const menuStats = { totalMenu, pending, approved, rejected };

    // analytics - dummy values for now
    const analytics = { visitors: 0, views: 0, ratings: 0 };

    return res.json({ success: true, restaurant, menus: menuRows, menuStats, analytics });
  } catch (err) {
    console.error('getMyStore error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data my-store' });
  }
};

module.exports = { getMyStore };
