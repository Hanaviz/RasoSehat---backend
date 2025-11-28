const db = require('../config/db.js');

const slugify = (text) => {
    return text.toString().toLowerCase()
        .normalize('NFKD')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/\-+/g, '-')
        .replace(/^-+|-+$/g, '');
};

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

// Create new menu with unique slug
MenuModel.create = async (data) => {
    // data should contain: restoran_id, kategori_id, nama_menu, deskripsi, bahan_baku,
    // metode_masak, diet_claims (stringified JSON), kalori, protein, gula, lemak, serat,
    // lemak_jenuh, harga, foto

    // Generate base slug
    let baseSlug = slugify(data.nama_menu || 'menu');
    let slug = baseSlug;
    let suffix = 0;

    // Ensure uniqueness
    while (true) {
        const [rows] = await db.execute('SELECT id FROM menu_makanan WHERE slug = ? LIMIT 1', [slug]);
        if (!rows || rows.length === 0) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
    }

    const sql = `INSERT INTO menu_makanan (
        restoran_id, kategori_id, nama_menu, deskripsi, bahan_baku, metode_masak,
        diet_claims, kalori, protein, gula, lemak, serat, lemak_jenuh, harga, foto, status_verifikasi, created_at, updated_at, slug
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW(), ?)`;

    const params = [
        data.restoran_id || null,
        data.kategori_id || null,
        data.nama_menu || null,
        data.deskripsi || null,
        data.bahan_baku || null,
        data.metode_masak || null,
        data.diet_claims || '[]',
        data.kalori || 0,
        data.protein || 0,
        data.gula || 0,
        data.lemak || 0,
        data.serat || 0,
        data.lemak_jenuh || 0,
        data.harga || 0,
        data.foto || null,
        slug
    ];

    const [result] = await db.execute(sql, params);
    const insertId = result.insertId;

    const [rows] = await db.execute(`
        SELECT m.*, r.nama_restoran, r.alamat FROM menu_makanan m
        JOIN restorans r ON m.restoran_id = r.id WHERE m.id = ? LIMIT 1
    `, [insertId]);

    return rows[0] || null;
};

MenuModel.findAll = async () => {
    const q = `SELECT m.*, r.nama_restoran, r.alamat FROM menu_makanan m JOIN restorans r ON m.restoran_id = r.id ORDER BY m.updated_at DESC`;
    const [rows] = await db.execute(q);
    return rows;
};

module.exports = MenuModel;

module.exports = MenuModel;