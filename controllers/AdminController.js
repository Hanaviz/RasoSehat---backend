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
        const [rows] = await db.execute(`SELECT id, user_id, nama_restoran, deskripsi, alamat, no_telepon, status_verifikasi, created_at FROM restorans WHERE status_verifikasi = 'pending' OR status_verifikasi = 'menunggu'`);
        return res.status(200).json(rows);
    } catch (err) {
        console.error('getPendingRestaurants error', err);
        return res.status(500).json({ message: 'Gagal mengambil daftar restoran pending.' });
    }
};

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

module.exports = {
    getPendingRestaurants,
    getPendingMenus,
    verifyRestaurant,
    verifyMenu,
};
