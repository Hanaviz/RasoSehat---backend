const pool = require('../config/db');

class RestaurantModel {
  static async createStep1({ nama_restoran, alamat, user_id }) {
    const sql = `INSERT INTO restorans (user_id, nama_restoran, alamat, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`;
    const [result] = await pool.query(sql, [user_id, nama_restoran, alamat]);
    const insertId = result.insertId;
    return this.findById(insertId);
  }

  static async updateStep2(id, {
    deskripsi, latitude, longitude, no_telepon, jenis_usaha,
    owner_name, phone_admin, operating_hours, sales_channels, social_media,
    store_category, commitment_checked, health_focus, dominant_cooking_method,
    dominant_fat, maps_latlong, slug
  }) {
    const sql = `UPDATE restorans SET
      deskripsi = ?, latitude = ?, longitude = ?, no_telepon = ?, jenis_usaha = ?,
      owner_name = ?, phone_admin = ?, operating_hours = ?, sales_channels = ?,
      social_media = ?, store_category = ?, commitment_checked = ?, health_focus = ?,
      dominant_cooking_method = ?, dominant_fat = ?, maps_latlong = ?, slug = ?,
      updated_at = NOW()
      WHERE id = ?`;

    await pool.query(sql, [
      deskripsi || null,
      latitude || null,
      longitude || null,
      no_telepon || null,
      jenis_usaha || 'perorangan',
      owner_name || null,
      phone_admin || null,
      operating_hours || null,
      sales_channels || null,
      social_media || null,
      store_category || null,
      commitment_checked ? 1 : 0,
      health_focus || null,
      dominant_cooking_method || null,
      dominant_fat || null,
      maps_latlong || null,
      slug || null,
      id
    ]);

    return this.findById(id);
  }

  static async updateStep3(id, { foto_ktp, npwp, dokumen_usaha, documents_json }) {
    const sql = `UPDATE restorans SET foto_ktp = ?, npwp = ?, dokumen_usaha = ?, documents_json = ?, updated_at = NOW() WHERE id = ?`;
    await pool.query(sql, [foto_ktp || null, npwp || null, dokumen_usaha || null, documents_json || null, id]);
    return this.findById(id);
  }

  static async submitFinal(id) {
    const sql = `UPDATE restorans SET status_verifikasi = 'pending', updated_at = NOW() WHERE id = ?`;
    await pool.query(sql, [id]);
    return this.findById(id);
  }

  static async findById(id) {
    const sql = `SELECT * FROM restorans WHERE id = ? LIMIT 1`;
    const [rows] = await pool.query(sql, [id]);
    const row = rows[0] || null;
    if (row) {
      // try to parse JSON columns safely
      try {
        row.health_focus = row.health_focus ? (typeof row.health_focus === 'string' ? JSON.parse(row.health_focus) : row.health_focus) : [];
      } catch (e) {
        row.health_focus = [];
      }
      try {
        row.dominant_cooking_method = row.dominant_cooking_method ? (typeof row.dominant_cooking_method === 'string' ? JSON.parse(row.dominant_cooking_method) : row.dominant_cooking_method) : [];
      } catch (e) {
        row.dominant_cooking_method = [];
      }
      try {
        row.documents_json = row.documents_json ? (typeof row.documents_json === 'string' ? JSON.parse(row.documents_json) : row.documents_json) : { foto_ktp: [], npwp: [], dokumen_usaha: [] };
      } catch (e) {
        row.documents_json = { foto_ktp: [], npwp: [], dokumen_usaha: [] };
      }
    }
    return row;
  }

  static async findByUserId(user_id) {
    const sql = `SELECT * FROM restorans WHERE user_id = ?`;
    const [rows] = await pool.query(sql, [user_id]);
    return rows;
  }

  static async findAll() {
    const sql = `SELECT * FROM restorans ORDER BY created_at DESC`;
    const [rows] = await pool.query(sql);
    return rows;
  }

  static async findBySlug(slug) {
    const sql = `
      SELECT id, user_id, nama_restoran, deskripsi, alamat, latitude, longitude, no_telepon
      FROM restorans
      WHERE nama_restoran = ? AND status_verifikasi = 'disetujui'
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [slug]);
    return rows[0] || null;
  }
}

module.exports = RestaurantModel;