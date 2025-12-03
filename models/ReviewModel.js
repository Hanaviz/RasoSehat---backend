const pool = require('../config/db');

class ReviewModel {
  // Tambah ulasan baru
  static async create({ user_id, menu_id, rating, komentar }) {
    const sql = `INSERT INTO ulasan (user_id, menu_id, rating, komentar, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`;
    const [result] = await pool.execute(sql, [user_id, menu_id, rating, komentar || null]);
    return result.insertId;
  }

  // Ambil ulasan berdasarkan menu_id, join dengan users untuk nama
  static async findByMenuId(menu_id) {
    const sql = `
      SELECT u.name, r.rating, r.komentar, r.created_at
      FROM ulasan r
      JOIN users u ON r.user_id = u.id
      WHERE r.menu_id = ?
      ORDER BY r.created_at DESC
    `;
    const [rows] = await pool.execute(sql, [menu_id]);
    return rows;
  }

  // Hitung rata-rata rating dan jumlah ulasan untuk menu
  static async getStats(menu_id) {
    const sql = `
      SELECT AVG(rating) as average_rating, COUNT(*) as total_reviews
      FROM ulasan
      WHERE menu_id = ?
    `;
    const [rows] = await pool.execute(sql, [menu_id]);
    const row = rows[0];
    return {
      average_rating: parseFloat(row.average_rating) || 0,
      total_reviews: parseInt(row.total_reviews) || 0
    };
  }

  // Update rating dan jumlah ulasan pada tabel menu_makanan
  static async updateMenuRating(menu_id) {
    // Hitung statistik ulasan terbaru
    const stats = await this.getStats(menu_id);

    // Update tabel menu_makanan
    const sql = `
      UPDATE menu_makanan
      SET rating = ?, reviews = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const [result] = await pool.execute(sql, [
      stats.average_rating,
      stats.total_reviews,
      menu_id
    ]);

    return result.affectedRows > 0;
  }
}

module.exports = ReviewModel;