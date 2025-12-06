const db = require('../config/db');
const { sendStoreVerificationEmail } = require('../utils/emailService');
const { sendStoreVerificationEmailTo } = require('../utils/emailService');

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
const NotificationModel = require('../models/NotificationModel');

const getPendingMenus = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT m.id, m.nama_menu, m.deskripsi, m.bahan_baku, m.metode_masak, m.diet_claims, 
                   m.kalori, m.protein, m.gula, m.lemak, m.serat, m.lemak_jenuh, m.harga, m.foto, 
                   m.status_verifikasi, m.catatan_admin, m.restoran_id, r.nama_restoran
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.status_verifikasi = 'pending' OR m.status_verifikasi = 'menunggu'
        `);
        // Parse diet_claims if it's JSON
        const processedRows = rows.map(row => ({
            ...row,
            diet_claims: row.diet_claims ? JSON.parse(row.diet_claims) : []
        }));
        return res.status(200).json(processedRows);
    } catch (err) {
        console.error('getPendingMenus error', err);
        return res.status(500).json({ message: 'Gagal mengambil daftar menu pending.' });
    }
};

// GET /admin/restaurants/active?page=&per_page=
const getActiveRestaurants = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(5, Number(req.query.per_page) || 20));
        const offset = (page - 1) * perPage;

        const [rows] = await db.execute(`
            SELECT id, user_id, nama_restoran, deskripsi, alamat, no_telepon, jenis_usaha, owner_name, owner_email, status_verifikasi, created_at, updated_at
            FROM restorans
            WHERE status_verifikasi = 'disetujui'
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
        `, [perPage, offset]);

        // return simple paging metadata
        return res.status(200).json({ data: rows, page, per_page: perPage });
    } catch (err) {
        console.error('getActiveRestaurants error', err);
        return res.status(500).json({ message: 'Gagal mengambil restoran aktif.' });
    }
};

// GET /admin/restaurants/history?page=&per_page=
const getRestaurantVerificationHistory = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(5, Number(req.query.per_page) || 20));
        const offset = (page - 1) * perPage;
        // Try the modern schema first (target_type/target_id/note/created_at)
        let rows;
        try {
            const q = `
                SELECT v.id, v.target_id AS restoran_id, v.admin_id, u.name AS admin_name, v.status, v.note AS catatan, v.created_at AS verified_at, r.nama_restoran
                FROM verifikasi v
                LEFT JOIN restorans r ON v.target_id = r.id
                LEFT JOIN users u ON v.admin_id = u.id
                WHERE v.target_type = 'restoran'
                ORDER BY v.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const result = await db.execute(q, [perPage, offset]);
            rows = result[0];
        } catch (primaryErr) {
            // Fallback for legacy schema: tipe_objek/objek_id/catatan/tanggal_verifikasi
            console.warn('[getRestaurantVerificationHistory] primary query failed, trying legacy schema fallback:', primaryErr && primaryErr.message ? primaryErr.message : primaryErr);
            const qLegacy = `
                SELECT v.id, v.objek_id AS restoran_id, v.admin_id, u.name AS admin_name, v.status, v.catatan AS catatan, v.tanggal_verifikasi AS verified_at, r.nama_restoran
                FROM verifikasi v
                LEFT JOIN restorans r ON v.objek_id = r.id
                LEFT JOIN users u ON v.admin_id = u.id
                WHERE v.tipe_objek = 'restoran'
                ORDER BY v.tanggal_verifikasi DESC
                LIMIT ? OFFSET ?
            `;
            const legacyResult = await db.execute(qLegacy, [perPage, offset]);
            rows = legacyResult[0];
        }

        return res.status(200).json({ data: rows, page, per_page: perPage });
    } catch (err) {
        console.error('getRestaurantVerificationHistory error', err);
        return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi restoran.' });
    }
};

// GET /admin/menus/active?page=&per_page=
const getActiveMenus = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(5, Number(req.query.per_page) || 20));
        const offset = (page - 1) * perPage;

        const q = `
            SELECT m.id, m.nama_menu, m.harga, m.foto, m.slug, m.kalori, m.protein, m.gula, m.lemak, m.serat, m.lemak_jenuh, r.nama_restoran
            FROM menu_makanan m
            JOIN restorans r ON m.restoran_id = r.id
            WHERE m.status_verifikasi = 'disetujui'
            ORDER BY m.updated_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.execute(q, [perPage, offset]);
        return res.status(200).json({ data: rows, page, per_page: perPage });
    } catch (err) {
        console.error('getActiveMenus error', err);
        return res.status(500).json({ message: 'Gagal mengambil menu aktif.' });
    }
};

// GET /admin/menus/history?page=&per_page=
const getMenuVerificationHistory = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(5, Number(req.query.per_page) || 20));
        const offset = (page - 1) * perPage;
        // Try modern schema first
        let rows;
        try {
            const q = `
                SELECT v.id, v.target_id AS menu_id, v.admin_id, u.name AS admin_name, v.status, v.note AS catatan, v.created_at AS verified_at,
                       m.nama_menu, r.nama_restoran
                FROM verifikasi v
                LEFT JOIN menu_makanan m ON v.target_id = m.id
                LEFT JOIN restorans r ON m.restoran_id = r.id
                LEFT JOIN users u ON v.admin_id = u.id
                WHERE v.target_type = 'menu'
                ORDER BY v.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const result = await db.execute(q, [perPage, offset]);
            rows = result[0];
        } catch (primaryErr) {
            console.warn('[getMenuVerificationHistory] primary query failed, trying legacy schema fallback:', primaryErr && primaryErr.message ? primaryErr.message : primaryErr);
            const qLegacy = `
                SELECT v.id, v.objek_id AS menu_id, v.admin_id, u.name AS admin_name, v.status, v.catatan AS catatan, v.tanggal_verifikasi AS verified_at,
                       m.nama_menu, r.nama_restoran
                FROM verifikasi v
                LEFT JOIN menu_makanan m ON v.objek_id = m.id
                LEFT JOIN restorans r ON m.restoran_id = r.id
                LEFT JOIN users u ON v.admin_id = u.id
                WHERE v.tipe_objek = 'menu'
                ORDER BY v.tanggal_verifikasi DESC
                LIMIT ? OFFSET ?
            `;
            const legacyResult = await db.execute(qLegacy, [perPage, offset]);
            rows = legacyResult[0];
        }

        return res.status(200).json({ data: rows, page, per_page: perPage });
    } catch (err) {
        console.error('getMenuVerificationHistory error', err);
        return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi menu.' });
    }
};

// Helper: robustly resolve owner user id and set role to 'penjual'
const setOwnerRoleToPenjual = async (restaurant) => {
    try {
        if (!restaurant) return null;
        let ownerId = restaurant.user_id || null;

        // Try owner email
        if (!ownerId) {
            const ownerEmail = restaurant.owner_email || restaurant.email || restaurant.ownerEmail || null;
            if (ownerEmail) {
                const [urows] = await db.execute('SELECT id, role FROM users WHERE email = ? LIMIT 1', [ownerEmail]);
                if (urows && urows[0] && urows[0].id) ownerId = urows[0].id;
            }
        }

        // Try phone number
        if (!ownerId && (restaurant.no_telepon || restaurant.phone_admin || restaurant.contact)) {
            const phone = restaurant.no_telepon || restaurant.phone_admin || restaurant.contact;
            const [urows] = await db.execute('SELECT id, role FROM users WHERE phone = ? LIMIT 1', [phone]);
            if (urows && urows[0] && urows[0].id) ownerId = urows[0].id;
        }

        // Try owner name (exact match fallback)
        if (!ownerId && restaurant.owner_name) {
            const [urows] = await db.execute('SELECT id, role FROM users WHERE name = ? LIMIT 1', [restaurant.owner_name]);
            if (urows && urows[0] && urows[0].id) ownerId = urows[0].id;
        }

        if (!ownerId) {
            console.warn('[setOwnerRoleToPenjual] could not resolve owner user id for restaurant', restaurant && restaurant.id);
            return null;
        }

        // Only update if not already 'penjual'
        const [cur] = await db.execute('SELECT role FROM users WHERE id = ? LIMIT 1', [ownerId]);
        const currentRole = cur && cur[0] ? cur[0].role : null;
        if (currentRole !== 'penjual') {
            await db.execute('UPDATE users SET role = ? WHERE id = ?', ['penjual', ownerId]);
            console.log(`[setOwnerRoleToPenjual] user ${ownerId} role set to 'penjual'`);
        }

        // Ensure restaurant row links to user_id if possible
        if (restaurant.id && Number(restaurant.user_id || 0) !== Number(ownerId)) {
            try {
                await db.execute('UPDATE restorans SET user_id = ? WHERE id = ?', [ownerId, restaurant.id]);
            } catch (linkErr) {
                console.warn('[setOwnerRoleToPenjual] could not link restaurant to owner user_id (non-fatal):', linkErr && linkErr.message ? linkErr.message : linkErr);
            }
        }

        return ownerId;
    } catch (err) {
        console.warn('[setOwnerRoleToPenjual] error', err && err.message ? err.message : err);
        return null;
    }
};

const verifyRestaurant = async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body; // expected: 'approved' | 'rejected' (or Indonesian equivalents)

    const dbStatus = mapStatus(status);
    if (!dbStatus) {
        return res.status(400).json({ message: 'Status tidak valid. Gunakan "approved" atau "rejected".' });
    }

    try {
        // Attempt to update restorans; include admin_note if column exists (non-fatal otherwise)
        try {
            const [result] = await db.execute('UPDATE restorans SET status_verifikasi = ?, admin_note = ?, verified_at = NOW() WHERE id = ?', [dbStatus, note || null, id]);
            if (result.affectedRows === 0) {
                // fallback: maybe no admin_note column; try simpler update
                const [r2] = await db.execute('UPDATE restorans SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
                if (r2.affectedRows === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            }
        } catch (e) {
            // Try fallback update if admin_note/verified_at do not exist
            try {
                const [r2] = await db.execute('UPDATE restorans SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
                if (r2.affectedRows === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            } catch (e2) {
                console.error('verifyRestaurant update fatal error', e2);
                return res.status(500).json({ message: 'Gagal memperbarui status restoran.' });
            }
        }

        // Insert a verifikasi record for audit trail; non-fatal if table/columns differ
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await db.execute('INSERT INTO verifikasi (target_type, target_id, user_id, admin_id, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                ['restoran', id, null, adminId, dbStatus, note || null]
            );
        } catch (e) {
            console.warn('Could not insert verifikasi log for restaurant (non-fatal):', e.message || e);
        }

        // Fetch restaurant to include in response and to send email
        const [rows] = await db.execute('SELECT * FROM restorans WHERE id = ?', [id]);
        const restaurant = rows && rows[0] ? rows[0] : null;

        // If restaurant approved, try to set owner's user.role to 'penjual' (best-effort)
        if (dbStatus === 'disetujui' && restaurant) {
            try {
                await setOwnerRoleToPenjual(restaurant);
            } catch (roleErr) {
                console.warn('[verifyRestaurant] failed to set user role to penjual (non-fatal):', roleErr && roleErr.message ? roleErr.message : roleErr);
            }
        }
        // Send notification email to owner (best-effort)
        try {
            const ownerEmail = restaurant && (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) ? (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) : null;
            console.log('[verifyRestaurant] will notify owner:', ownerEmail, 'status:', dbStatus, 'notePresent:', !!note);
            if (ownerEmail) {
                    // Insert internal notification (preferred) and attempt email as best-effort
                    try {
                        // Prefer explicit owner id from restaurant row when available
                        const ownerIdFromRow = restaurant && (restaurant.user_id || restaurant.owner_user_id) ? (restaurant.user_id || restaurant.owner_user_id) : null;
                        let ownerId = ownerIdFromRow;
                        if (!ownerId && ownerEmail) {
                            const [urows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [ownerEmail]);
                            ownerId = (urows && urows[0] && urows[0].id) ? urows[0].id : null;
                        }
                        // If we found an ownerId but the restaurant row is not linked to it, attempt to link the restaurant to the user
                        if (ownerId && restaurant && Number(restaurant.user_id) !== Number(ownerId)) {
                            try {
                                await db.execute('UPDATE restorans SET user_id = ? WHERE id = ?', [ownerId, restaurant.id]);
                                restaurant.user_id = ownerId;
                            } catch (linkErr) {
                                console.warn('[patchVerifyRestaurant] could not link restaurant to owner user_id (non-fatal):', linkErr && linkErr.message ? linkErr.message : linkErr);
                            }
                        }
                        // If we found an ownerId but the restaurant row is not linked to it, attempt to link the restaurant to the user
                        if (ownerId && restaurant && Number(restaurant.user_id) !== Number(ownerId)) {
                            try {
                                await db.execute('UPDATE restorans SET user_id = ? WHERE id = ?', [ownerId, restaurant.id]);
                                // reflect in local object for subsequent operations
                                restaurant.user_id = ownerId;
                            } catch (linkErr) {
                                console.warn('[verifyRestaurant] could not link restaurant to owner user_id (non-fatal):', linkErr && linkErr.message ? linkErr.message : linkErr);
                            }
                        }
                        const title = dbStatus === 'disetujui' ? 'Toko Anda Disetujui' : 'Toko Anda Ditolak';
                        const message = note || (dbStatus === 'disetujui' ? 'Admin telah menyetujui toko Anda. Silakan lanjutkan pendaftaran penjual.' : 'Pendaftaran toko Anda ditolak. Mohon periksa dokumen dan ajukan kembali.');
                        const payload = { restaurant_id: restaurant.id, status: dbStatus, note: note || null };
                        await NotificationModel.createNotification({ user_id: ownerId, recipient_email: ownerEmail, type: dbStatus === 'disetujui' ? 'success' : 'warning', title, message, data: payload });
                    } catch (notifErr) {
                        console.warn('[verifyRestaurant] could not insert notification (non-fatal):', notifErr && notifErr.message ? notifErr.message : notifErr);
                    }
                    // Try sending email as optional fallback
                    await sendStoreVerificationEmail(restaurant, ownerEmail, dbStatus, note || '');
                    console.log('[verifyRestaurant] email send attempted to', ownerEmail);
            } else {
                console.warn('[verifyRestaurant] owner email not found in restaurant row, skipping email');
            }
        } catch (emailErr) {
            console.error('[verifyRestaurant] failed to send email (non-fatal):', emailErr && emailErr.message ? emailErr.message : emailErr);
        }

        return res.status(200).json({ message: 'Status restoran diperbarui.', restaurant });
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

// New: PATCH /admin/restaurants/:id/verify
// Body: { status: 'approved' | 'rejected', note: string }
const patchVerifyRestaurant = async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body || {};

    const dbStatus = mapStatus(status);
    if (!dbStatus) return res.status(400).json({ message: 'Status tidak valid. Gunakan "approved" atau "rejected".' });

    try {
        // Update restorans with admin note and verified timestamp (best-effort)
        try {
            const [r] = await db.execute('UPDATE restorans SET status_verifikasi = ?, admin_note = ?, verified_at = NOW() WHERE id = ?', [dbStatus, note || null, id]);
            if (r.affectedRows === 0) {
                // fallback to simple update
                const [r2] = await db.execute('UPDATE restorans SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
                if (r2.affectedRows === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            }
        } catch (e) {
            // try fallback
            try {
                const [r2] = await db.execute('UPDATE restorans SET status_verifikasi = ? WHERE id = ?', [dbStatus, id]);
                if (r2.affectedRows === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            } catch (ee) {
                console.error('patchVerifyRestaurant update failed', ee);
                return res.status(500).json({ message: 'Gagal memperbarui status restoran.' });
            }
        }

        // Audit log (non-fatal)
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await db.execute('INSERT INTO verifikasi (target_type, target_id, user_id, admin_id, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                ['restoran', id, null, adminId, dbStatus, note || null]
            );
        } catch (e) {
            console.warn('patchVerifyRestaurant: could not insert verifikasi audit (non-fatal):', e && e.message ? e.message : e);
        }

        // Fetch restaurant row to include in response
        const [rows] = await db.execute('SELECT * FROM restorans WHERE id = ?', [id]);
        const restaurant = rows && rows[0] ? rows[0] : null;

        // Send email by address (best-effort)
        try {
            const ownerEmail = restaurant && (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) ? (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) : null;
            console.log('[patchVerifyRestaurant] notify owner:', ownerEmail, 'status:', dbStatus);
            if (ownerEmail) {
                // Insert internal notification for owner
                    try {
                        // Prefer explicit owner id from restaurant row when available
                        const ownerIdFromRow = restaurant && (restaurant.user_id || restaurant.owner_user_id) ? (restaurant.user_id || restaurant.owner_user_id) : null;
                        let ownerId = ownerIdFromRow;
                        if (!ownerId && ownerEmail) {
                            const [urows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [ownerEmail]);
                            ownerId = (urows && urows[0] && urows[0].id) ? urows[0].id : null;
                        }
                        const title = dbStatus === 'disetujui' ? 'Toko Anda Disetujui' : 'Toko Anda Ditolak';
                        const message = note || (dbStatus === 'disetujui' ? 'Admin telah menyetujui toko Anda. Silakan lanjutkan pendaftaran penjual.' : 'Pendaftaran toko Anda ditolak. Mohon periksa dokumen dan ajukan kembali.');
                        const payload = { restaurant_id: restaurant.id, status: dbStatus, note: note || null };
                        await NotificationModel.createNotification({ user_id: ownerId, recipient_email: ownerEmail, type: dbStatus === 'disetujui' ? 'success' : 'warning', title, message, data: payload });
                    } catch (notifErr) {
                        console.warn('[patchVerifyRestaurant] could not insert notification (non-fatal):', notifErr && notifErr.message ? notifErr.message : notifErr);
                    }
                // convenience wrapper: sendStoreVerificationEmailTo(email, status, note, restaurantId)
                await sendStoreVerificationEmailTo(ownerEmail, dbStatus, note || '', restaurant && restaurant.id);
                console.log('[patchVerifyRestaurant] email attempted to', ownerEmail);
            } else {
                console.warn('[patchVerifyRestaurant] owner email not found, skipping email');
            }
        } catch (emailErr) {
            console.error('[patchVerifyRestaurant] email send failed (non-fatal):', emailErr && emailErr.message ? emailErr.message : emailErr);
        }

        // If approved, try to set owner's user.role to 'penjual' (best-effort)
        if (dbStatus === 'disetujui' && restaurant) {
            try {
                await setOwnerRoleToPenjual(restaurant);
            } catch (roleErr) {
                console.warn('[patchVerifyRestaurant] failed to set user role to penjual (non-fatal):', roleErr && roleErr.message ? roleErr.message : roleErr);
            }
        }

        return res.status(200).json({ message: 'Status restoran diperbarui.', restaurant });
    } catch (err) {
        console.error('patchVerifyRestaurant error', err);
        return res.status(500).json({ message: 'Gagal memperbarui status restoran.' });
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
    patchVerifyRestaurant,
    getActiveRestaurants,
    getRestaurantVerificationHistory,
    getActiveMenus,
    getMenuVerificationHistory,
};

