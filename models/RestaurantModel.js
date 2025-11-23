const db = require('../config/db.js');

const RestaurantModel = {
    // Fungsi untuk mendapatkan detail restoran (digunakan di Menu Detail)
    findBySlug: async (slug) => {
        const query = `
            SELECT id, user_id, nama_restoran, deskripsi, alamat, latitude, longitude, no_telepon
            FROM restorans
            WHERE nama_restoran = ? AND status_verifikasi = 'disetujui'
        `;
        const [rows] = await db.execute(query, [slug]);
        return rows[0];
    },
    // Nanti akan ditambahkan fungsi untuk mendaftar toko (RegisterStorePage)
};

module.exports = RestaurantModel;