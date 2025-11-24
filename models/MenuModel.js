const db = require('../config/db.js');

const MenuModel = {
    // Fungsi untuk Mendapatkan Menu Unggulan (Home Page)
    getFeaturedMenus: async (limit = 10) => {
        const query = `
            SELECT 
                m.id, m.nama_menu, m.deskripsi, m.harga, m.foto, m.kalori, m.protein, 
                m.diet_claims, r.nama_restoran, r.alamat
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.status_verifikasi = 'disetujui'
            ORDER BY m.updated_at DESC
            LIMIT ?
        `;
        const [rows] = await db.execute(query, [limit]);
        return rows;
    },

    // Fungsi untuk Pencarian dan Filter
    searchAndFilter: async (query, categoryId, minRating, limit = 20) => {
        // CATATAN: Implementasi filter kompleks seperti rating dan distance membutuhkan data yang lebih lengkap
        let baseQuery = `
            SELECT 
                m.id, m.nama_menu, m.deskripsi, m.harga, m.foto, m.kalori, m.gula, m.lemak, m.diet_claims,
                r.nama_restoran, r.alamat, r.latitude, r.longitude
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.status_verifikasi = 'disetujui' 
        `;
        const params = [];

        if (query) {
            baseQuery += ' AND (m.nama_menu LIKE ? OR m.deskripsi LIKE ?)';
            params.push(`%${query}%`, `%${query}%`);
        }

        if (categoryId) {
            baseQuery += ' AND m.kategori_id = ?';
            params.push(categoryId);
        }

        // Contoh filter Rendah Kalori (Contoh Implementasi Berbasis Data di DB)
        // if (isLowCalorie) {
        //     baseQuery += ' AND m.kalori <= 400';
        // }

        baseQuery += ' LIMIT ?';
        params.push(limit);
        
        const [rows] = await db.execute(baseQuery, params);
        return rows;
    },
    
    // Fungsi untuk Detail Menu
    getMenuDetail: async (id) => {
        const query = `
            SELECT 
                m.*, r.nama_restoran, r.alamat, r.no_telepon, 
                r.latitude, r.longitude
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.id = ? AND m.status_verifikasi = 'disetujui'
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0];
    }
    ,
    // Fungsi untuk mendapatkan menu berdasarkan slug.
    // Prefer explicit `slug` column if present, otherwise fall back to name normalization.
    getMenuBySlug: async (slug) => {
        // First try matching the explicit slug column
        const qSlug = `
            SELECT 
                m.*, r.nama_restoran, r.alamat, r.no_telepon,
                r.latitude, r.longitude
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.slug = ? AND m.status_verifikasi = 'disetujui' LIMIT 1
        `;
        try {
            const [rows] = await db.execute(qSlug, [slug]);
            if (rows && rows.length) return rows[0];
        } catch (e) {
            // If query fails (e.g. slug column doesn't exist), we'll fall back
            // to name-based lookup below.
        }

        // Fallback: try to match by normalized name (legacy behavior)
        const nameCandidate = slug.replace(/-/g, ' ');
        const qNorm = `
            SELECT 
                m.*, r.nama_restoran, r.alamat, r.no_telepon,
                r.latitude, r.longitude
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE (LOWER(REPLACE(m.nama_menu, ' ', '-')) = LOWER(?))
              AND m.status_verifikasi = 'disetujui'
            LIMIT 1
        `;
        const [rowsNorm] = await db.execute(qNorm, [slug]);
        if (rowsNorm && rowsNorm.length) return rowsNorm[0];

        // final fallback: exact name match
        const qExact = `
            SELECT 
                m.*, r.nama_restoran, r.alamat, r.no_telepon,
                r.latitude, r.longitude
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE LOWER(m.nama_menu) = LOWER(?) AND m.status_verifikasi = 'disetujui' LIMIT 1
        `;
        const [rowsExact] = await db.execute(qExact, [nameCandidate]);
        return rowsExact[0];
    }
};

module.exports = MenuModel;