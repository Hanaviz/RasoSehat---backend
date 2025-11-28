const db = require('../config/db');

// Helper to map incoming status values to DB values
const mapStatus = (status) => {
    if (!status) return null;
    const s = String(status).toLowerCase();
    if (s === 'approved' || s === 'disetujui' || s === 'approve') return 'disetujui';
    if (s === 'rejected' || s === 'ditolak' || s === 'reject') return 'ditolak';
    return null;
};

const getPendingRestaurants = async (req, res) => {
    try {
        // Return a broad set of columns so admin can review all submitted data including documents_json
        const [rows] = await db.execute(`
            SELECT id, user_id, nama_restoran, deskripsi, alamat, no_telepon, jenis_usaha,
                   owner_name, owner_email, phone_admin, operating_hours, sales_channels, social_media,
                   store_category, commitment_checked, health_focus, dominant_cooking_method, dominant_fat,
                   maps_latlong, foto_ktp, npwp, dokumen_usaha, documents_json, status_verifikasi, created_at
            FROM restorans
            WHERE status_verifikasi = 'pending' OR status_verifikasi = 'menunggu'
            ORDER BY created_at DESC
        `);

        // Normalize rows to a consistent shape expected by the frontend
        const normalized = rows.map(r => {
            const safeParse = (v, fallback) => {
                if (v === null || v === undefined) return fallback;
                if (typeof v === 'string') {
                    try { return JSON.parse(v); } catch { return fallback; }
                }
                return v;
            };

            const healthFocus = safeParse(r.health_focus, []);
            const cookingMethods = safeParse(r.dominant_cooking_method, []);
            const docsObj = safeParse(r.documents_json, { foto_ktp: [], npwp: [], dokumen_usaha: [] });

            // aggregate documents into a single array (preserve order and fallbacks)
            const docs = [];
            if (Array.isArray(docsObj.foto_ktp)) docs.push(...docsObj.foto_ktp);
            if (Array.isArray(docsObj.dokumen_usaha)) docs.push(...docsObj.dokumen_usaha);
            if (Array.isArray(docsObj.npwp)) docs.push(...docsObj.npwp);

            // fallback to single-file columns if documents array empty
            if (!docs.length) {
                if (r.foto_ktp) docs.push(r.foto_ktp);
                if (r.dokumen_usaha) docs.push(r.dokumen_usaha);
                if (r.npwp) docs.push(r.npwp);
            }

            return {
                id: r.id,
                user_id: r.user_id,
                nama_restoran: r.nama_restoran,
                name: r.nama_restoran,
                deskripsi: r.deskripsi,
                concept: r.deskripsi,
                alamat: r.alamat,
                address: r.alamat,
                no_telepon: r.no_telepon,
                phone_admin: r.phone_admin,
                owner_name: r.owner_name,
                owner_email: r.owner_email,
                owner: r.owner_name || r.user_id,
                ownerEmail: r.owner_email,
                operating_hours: r.operating_hours,
                openHours: r.operating_hours,
                sales_channels: r.sales_channels,
                social_media: r.social_media,
                store_category: r.store_category,
                storeCategory: r.store_category,
                commitment_checked: r.commitment_checked,
                health_focus: healthFocus,
                healthFocus: healthFocus,
                dominant_cooking_method: cookingMethods,
                dominantCookingMethod: cookingMethods,
                dominant_fat: r.dominant_fat,
                dominantFat: r.dominant_fat,
                maps_latlong: r.maps_latlong,
                mapsLatLong: r.maps_latlong,
                documents_json: docsObj,
                documents: docs,
                foto_ktp: r.foto_ktp,
                npwp: r.npwp,
                dokumen_usaha: r.dokumen_usaha,
                status_verifikasi: r.status_verifikasi,
                created_at: r.created_at
            };
        });

        return res.status(200).json(normalized);
    } catch (err) {
        console.error('getPendingRestaurants error', err);
        return res.status(500).json({ message: 'Gagal mengambil daftar restoran pending.' });
    }
};

const RestaurantModel = require('../models/RestaurantModel');

const getPendingMenus = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT m.id, m.nama_menu, m.deskripsi, m.harga, m.foto, m.status_verifikasi, m.restoran_id, r.nama_restoran
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.status_verifikasi = 'pending' OR m.status_verifikasi = 'menunggu'
        `);
        return res.status(200).json(rows);
    } catch (err) {
        console.error('getPendingMenus error', err);
        return res.status(500).json({ message: 'Gagal mengambil daftar menu pending.' });
    }
};

const verifyRestaurant = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // expected: 'approved' | 'rejected' (or Indonesian equivalents)

    const dbStatus = mapStatus(status);
    if (!dbStatus) {
        return res.status(400).json({ message: 'Status tidak valid. Gunakan "approved" atau "rejected".' });
    }

    try {
        const [result] = await db.execute('UPDATE restorans SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });

        // Insert a verifikasi record for audit trail; non-fatal if table/columns differ
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await db.execute('INSERT INTO verifikasi (target_type, target_id, user_id, admin_id, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                ['restoran', id, null, adminId, dbStatus, `Update performed by admin ${adminId}`]
            );
        } catch (e) {
            console.warn('Could not insert verifikasi log for restaurant (non-fatal):', e.message || e);
        }

        const [rows] = await db.execute('SELECT id, user_id, nama_restoran, status_verifikasi FROM restorans WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Status restoran diperbarui.', restaurant: rows[0] });
    } catch (err) {
        console.error('verifyRestaurant error', err);
        return res.status(500).json({ message: 'Gagal memperbarui status restoran.' });
    }
};

const verifyMenu = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // expected: 'approved' | 'rejected'

    const dbStatus = mapStatus(status);
    if (!dbStatus) {
        return res.status(400).json({ message: 'Status tidak valid. Gunakan "approved" atau "rejected".' });
    }

    try {
        const [result] = await db.execute('UPDATE menu_makanan SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Menu tidak ditemukan.' });

        // Log verifikasi action for menu
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await db.execute('INSERT INTO verifikasi (target_type, target_id, user_id, admin_id, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                ['menu', id, null, adminId, dbStatus, `Menu status updated by admin ${adminId}`]
            );
        } catch (e) {
            console.warn('Could not insert verifikasi log for menu (non-fatal):', e.message || e);
        }

        const [rows] = await db.execute('SELECT id, nama_menu, status_verifikasi, restoran_id FROM menu_makanan WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Status menu diperbarui.', menu: rows[0] });
    } catch (err) {
        console.error('verifyMenu error', err);
        return res.status(500).json({ message: 'Gagal memperbarui status menu.' });
    }
};

const getRestaurantById = async (req, res) => {
    try {
        const id = req.params.id;
        const r = await RestaurantModel.findById(id);
        if (!r) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });

        const safeParse = (v, fallback) => {
            if (v === null || v === undefined) return fallback;
            if (typeof v === 'string') {
                try { return JSON.parse(v); } catch { return fallback; }
            }
            return v;
        };

        const healthFocus = safeParse(r.health_focus, Array.isArray(r.health_focus) ? r.health_focus : []);
        const cookingMethods = safeParse(r.dominant_cooking_method, Array.isArray(r.dominant_cooking_method) ? r.dominant_cooking_method : []);
        const docsObj = safeParse(r.documents_json, (r.documents_json && typeof r.documents_json === 'object') ? r.documents_json : { foto_ktp: [], npwp: [], dokumen_usaha: [] });

        const docs = [];
        if (docsObj && Array.isArray(docsObj.foto_ktp)) docs.push(...docsObj.foto_ktp);
        if (docsObj && Array.isArray(docsObj.dokumen_usaha)) docs.push(...docsObj.dokumen_usaha);
        if (docsObj && Array.isArray(docsObj.npwp)) docs.push(...docsObj.npwp);

        if (!docs.length) {
            if (r.foto_ktp) docs.push(r.foto_ktp);
            if (r.dokumen_usaha) docs.push(r.dokumen_usaha);
            if (r.npwp) docs.push(r.npwp);
        }

        const normalized = {
            id: r.id,
            user_id: r.user_id,
            nama_restoran: r.nama_restoran,
            name: r.nama_restoran,
            deskripsi: r.deskripsi,
            concept: r.deskripsi,
            alamat: r.alamat,
            address: r.alamat,
            no_telepon: r.no_telepon,
            phone_admin: r.phone_admin,
            owner_name: r.owner_name,
            owner_email: r.owner_email,
            owner: r.owner_name || r.user_id,
            ownerEmail: r.owner_email,
            operating_hours: r.operating_hours,
            openHours: r.operating_hours,
            sales_channels: r.sales_channels,
            social_media: r.social_media,
            store_category: r.store_category,
            storeCategory: r.store_category,
            commitment_checked: r.commitment_checked,
            health_focus: healthFocus,
            healthFocus: healthFocus,
            dominant_cooking_method: cookingMethods,
            dominantCookingMethod: cookingMethods,
            dominant_fat: r.dominant_fat,
            dominantFat: r.dominant_fat,
            maps_latlong: r.maps_latlong,
            mapsLatLong: r.maps_latlong,
            documents_json: docsObj,
            documents: docs,
            foto_ktp: r.foto_ktp,
            npwp: r.npwp,
            dokumen_usaha: r.dokumen_usaha,
            status_verifikasi: r.status_verifikasi,
            created_at: r.created_at
        };

        return res.status(200).json(normalized);
    } catch (err) {
        console.error('getRestaurantById error', err);
        return res.status(500).json({ message: 'Gagal mengambil data restoran.' });
    }
};
module.exports = {
    getPendingRestaurants,
    getPendingMenus,
    verifyRestaurant,
    verifyMenu,
    getRestaurantById,
};

