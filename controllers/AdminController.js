const supabase = require('../supabase/supabaseClient');
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

// Known status variants (be permissive to handle legacy/seeded values)
const PENDING_STATUSES = ['pending', 'menunggu', 'waiting', 'pending_verification'];
const APPROVED_STATUSES = ['disetujui', 'approved', 'verify', 'verified', 'approve'];

const getPendingRestaurants = async (req, res) => {
    try {
        // Return a broad set of columns so admin can review all submitted data including documents_json
        const { data: rows, error } = await supabase.from('restorans')
            .select('*')
            .in('status_verifikasi', PENDING_STATUSES)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('getPendingRestaurants supabase error', error);
            throw error;
        }

        // Normalize rows to a consistent shape expected by the frontend
        const normalized = rows.map(row => {
            const safeParse = (v, fallback) => {
                if (v === null || v === undefined) return fallback;
                if (typeof v === 'string') {
                    try { return JSON.parse(v); } catch { return fallback; }
                }
                return v;
            };

            const healthFocus = safeParse(row.health_focus, []);
            const cookingMethods = safeParse(row.dominant_cooking_method, []);
            const docsObj = safeParse(row.documents_json, { foto_ktp: [], npwp: [], dokumen_usaha: [] });

            // aggregate documents into a single array (preserve order and fallbacks)
            const docs = [];
            if (Array.isArray(docsObj.foto_ktp)) docs.push(...docsObj.foto_ktp);
            if (Array.isArray(docsObj.dokumen_usaha)) docs.push(...docsObj.dokumen_usaha);
            if (Array.isArray(docsObj.npwp)) docs.push(...docsObj.npwp);

            // fallback to single-file columns if documents array empty
            if (!docs.length) {
                if (row.foto_ktp) docs.push(row.foto_ktp);
                if (row.dokumen_usaha) docs.push(row.dokumen_usaha);
                if (row.npwp) docs.push(row.npwp);
            }

            return {
                id: row.id,
                user_id: row.user_id,
                nama_restoran: row.nama_restoran,
                name: row.nama_restoran,
                deskripsi: row.deskripsi,
                concept: row.deskripsi,
                alamat: row.alamat,
                address: row.alamat,
                no_telepon: row.no_telepon,
                phone_admin: row.phone_admin,
                owner_name: row.owner_name,
                owner_email: row.owner_email,
                owner: row.owner_name || row.user_id,
                ownerEmail: row.owner_email,
                operating_hours: row.operating_hours,
                openHours: row.operating_hours,
                sales_channels: row.sales_channels,
                social_media: row.social_media,
                store_category: row.store_category,
                storeCategory: row.store_category,
                commitment_checked: row.commitment_checked,
                health_focus: healthFocus,
                healthFocus: healthFocus,
                dominant_cooking_method: cookingMethods,
                dominantCookingMethod: cookingMethods,
                dominant_fat: row.dominant_fat,
                dominantFat: row.dominant_fat,
                maps_latlong: row.maps_latlong,
                mapsLatLong: row.maps_latlong,
                documents_json: docsObj,
                documents: docs,
                foto_ktp: row.foto_ktp,
                npwp: row.npwp,
                dokumen_usaha: row.dokumen_usaha,
                    // normalize status_verifikasi to lower-case trimmed value for frontend consistency
                    status_verifikasi: row.status_verifikasi ? String(row.status_verifikasi).trim().toLowerCase() : row.status_verifikasi,
                created_at: row.created_at
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
        // Fetch pending menus; join with restaurans via model to keep compatibility
        // Fetch pending menus and include pivot relations (bahan_baku + diet_claims)
        const { data: menus, error } = await supabase.from('menu_makanan')
            .select('id,restoran_id,kategori_id,nama_menu,deskripsi,harga,foto,status_verifikasi,created_at,updated_at,menu_bahan_baku(bahan_baku(id,nama)),menu_diet_claims(diet_claims_list(id,nama))')
            .in('status_verifikasi', ['pending','menunggu']);
        if (error) { console.error('getPendingMenus supabase error', error); throw error; }

        const processedRows = (menus || []).map(row => ({
            id: row.id,
            restoran_id: row.restoran_id,
            nama_menu: row.nama_menu,
            deskripsi: row.deskripsi,
            harga: row.harga,
            foto: row.foto,
            status_verifikasi: row.status_verifikasi,
            created_at: row.created_at,
            updated_at: row.updated_at,
            bahan_baku: Array.isArray(row.menu_bahan_baku) ? row.menu_bahan_baku.map(m => m.bahan_baku) : [],
            diet_claims: Array.isArray(row.menu_diet_claims) ? row.menu_diet_claims.map(m => m.diet_claims_list) : []
        }));

        for (const m of processedRows) {
            try {
                if (m.restoran_id) {
                    const r = await RestaurantModel.findById(m.restoran_id);
                    m.nama_restoran = r ? r.nama_restoran : null;
                }
            } catch (e) { /* non-fatal */ }
        }

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

                const fromIndex = offset;
                const toIndex = offset + perPage - 1;
                // Only return rows whose status_verifikasi matches one of the approved variants
                const { data: rows, error } = await supabase.from('restorans')
                    .select('*')
                    .in('status_verifikasi', APPROVED_STATUSES)
                    .order('updated_at', { ascending: false })
                    .range(fromIndex, toIndex);
                if (error) { console.error('getActiveRestaurants supabase error', error); throw error; }

        // Normalize statuses for frontend consistency
        const normalized = (rows || []).map(r => ({
            ...r,
            status_verifikasi: r.status_verifikasi ? String(r.status_verifikasi).trim().toLowerCase() : r.status_verifikasi
        }));

        // return simple paging metadata
        return res.status(200).json({ data: normalized, page, per_page: perPage });
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
        const fromIndex = offset;
        const toIndex = offset + perPage - 1;

        console.debug(`[getRestaurantVerificationHistory] params page=${page} per_page=${perPage} range=${fromIndex}-${toIndex}`);

        // Fetch verifikasi rows with exact count when supported
        let verRows = [];
        let total = 0;
        try {
            // Support optional filters: start_date, end_date, status
            const startDate = req.query.start_date || null;
            const endDate = req.query.end_date || null;
            const statusFilter = req.query.status || null;
            let q = supabase.from('verifikasi_restoran').select('*', { count: 'exact' }).order('tanggal_verifikasi', { ascending: false });
            if (statusFilter) q = q.eq('status', statusFilter);
            if (startDate) q = q.gte('tanggal_verifikasi', startDate);
            if (endDate) q = q.lte('tanggal_verifikasi', endDate);
            const resp = await q.range(fromIndex, toIndex);
            verRows = resp.data || [];
            total = typeof resp.count === 'number' ? resp.count : (Array.isArray(verRows) ? verRows.length : 0);
        } catch (e) {
            console.error('[getRestaurantVerificationHistory] supabase call threw', e && e.message ? e.message : e);
            return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi restoran (supabase call threw).' });
        }

        const enriched = [];
        const possibleTypeKeys = ['target_type','tipe_target','jenis_target','type','target'];
        const possibleTargetIdKeys = ['target_id','objek_id','object_id','id_objek','targetid'];

        // verifikasi_restoran has explicit restoran_id column
        const filteredVerRows = verRows || [];

        for (const v of filteredVerRows) {
            const restoranId = v.restoran_id || null;
            let nama_restoran = null;
            if (restoranId) {
                try {
                    const r = await RestaurantModel.findById(restoranId);
                    nama_restoran = r ? r.nama_restoran : null;
                } catch (e) { /* non-fatal */ }
            }

            let admin_name = null;
            if (v.admin_id) {
                try {
                    const { data: urows } = await supabase.from('users').select('name').eq('id', v.admin_id).limit(1);
                    if (urows && urows.length) admin_name = urows[0].name;
                } catch (e) { /* non-fatal */ }
            }

            enriched.push({
                id: v.id,
                restoran_id: restoranId,
                admin_id: v.admin_id,
                admin_name,
                status: v.status,
                catatan: v.catatan || v.note || null,
                verified_at: v.tanggal_verifikasi || v.created_at || null,
                nama_restoran
            });
        }

        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
        return res.status(200).json({ success: true, data: enriched, pagination: { page, per_page: perPage, total, total_pages: totalPages } });
    } catch (err) {
        console.error('getRestaurantVerificationHistory error', err && err.stack ? err.stack : err);
        if (process.env.NODE_ENV === 'development') {
            return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi restoran.', error: err && err.message ? String(err.message) : String(err) });
        }
        return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi restoran.' });
    }
};
// GET /admin/menus/active?page=&per_page=
const getActiveMenus = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(100, Math.max(5, Number(req.query.per_page) || 20));
        const offset = (page - 1) * perPage;

        // Fetch menus and attach restaurant name where possible
        const fromIndex = offset;
        const toIndex = offset + perPage - 1;
        const { data: menus, error: menusErr } = await supabase.from('menu_makanan')
          .select('*')
          .eq('status_verifikasi', 'disetujui')
          .order('updated_at', { ascending: false })
          .range(fromIndex, toIndex);
        if (menusErr) { console.error('getActiveMenus supabase error', menusErr); throw menusErr; }

        const rows = menus || [];
        for (const m of rows) {
            try {
                if (m.restoran_id) {
                    const r = await RestaurantModel.findById(m.restoran_id);
                    m.nama_restoran = r ? r.nama_restoran : null;
                }
            } catch (e) { /* non-fatal */ }
        }
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
        // Best-effort: fetch verifikasi rows for menus and enrich with menu and restaurant names
        const fromIndex = offset;
        const toIndex = offset + perPage - 1;
                console.debug(`[getMenuVerificationHistory] params page=${page} per_page=${perPage} range=${fromIndex}-${toIndex}`);
                let verRows, vError, resp;
                try {
                    // Fetch verifikasi rows without filtering (some DB schemas lack target_type)
                    const startDate = req.query.start_date || null;
                    const endDate = req.query.end_date || null;
                    const statusFilter = req.query.status || null;
                    let mq = supabase.from('verifikasi_menu').select('*', { count: 'exact' }).order('tanggal_verifikasi', { ascending: false });
                    if (statusFilter) mq = mq.eq('status', statusFilter);
                    if (startDate) mq = mq.gte('tanggal_verifikasi', startDate);
                    if (endDate) mq = mq.lte('tanggal_verifikasi', endDate);
                    resp = await mq.range(fromIndex, toIndex);
                    verRows = resp.data || [];
                    vError = resp.error || null;
                } catch (e) {
                    console.error('[getMenuVerificationHistory] supabase call threw', e && e.message ? e.message : e);
                    return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi menu (supabase call threw).' });
                }
                if (vError) {
                    console.error('getMenuVerificationHistory supabase fetch error', vError);
                    return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi menu.' });
                }

            const enriched = [];
            // Filter rows that look like menu verifications
            const possibleTypeKeys = ['target_type','tipe_target','jenis_target','type','target'];
            const possibleTargetIdKeys = ['target_id','objek_id','object_id','id_objek','targetid'];
            const filteredVerRows = (verRows || []).filter(v => {
                const typeVal = possibleTypeKeys.map(k => v && v[k]).find(Boolean);
                if (typeVal) {
                const tv = String(typeVal).toLowerCase();
                return tv.includes('menu') || tv.includes('makanan') || tv.includes('dish');
                }
                const tid = possibleTargetIdKeys.map(k => v && v[k]).find(id => typeof id !== 'undefined' && id !== null);
                return typeof tid !== 'undefined' && tid !== null;
            });

            for (const v of filteredVerRows) {
                try {
                    const menuId = v.target_id || v.objek_id || null;
                    let nama_menu = null;
                    let nama_restoran = null;
                    let foto_menu = null;
                    if (menuId) {
                        try {
                            const { data: mrows } = await supabase.from('menu_makanan').select('id,nama_menu,restoran_id,foto').eq('id', menuId).limit(1);
                            if (mrows && mrows.length) {
                                nama_menu = mrows[0].nama_menu;
                                foto_menu = mrows[0].foto || null;
                                if (mrows[0].restoran_id) {
                                    const r = await RestaurantModel.findById(mrows[0].restoran_id);
                                    nama_restoran = r ? r.nama_restoran : null;
                                }
                            }
                        } catch (innerErr) {
                            console.warn('[getMenuVerificationHistory] failed to fetch menu details for id=', menuId, innerErr && innerErr.message ? innerErr.message : innerErr);
                        }
                    }

                    let admin_name = null;
                    if (v.admin_id) {
                        try {
                            const { data: urows } = await supabase.from('users').select('name').eq('id', v.admin_id).limit(1);
                            if (urows && urows.length) admin_name = urows[0].name;
                        } catch (innerErr) {
                            console.warn('[getMenuVerificationHistory] failed to fetch admin name for admin_id=', v.admin_id, innerErr && innerErr.message ? innerErr.message : innerErr);
                        }
                    }

                    enriched.push({
                        id: v.id,
                        menu_id: menuId,
                        admin_id: v.admin_id,
                        admin_name,
                        status: v.status || null,
                        catatan: v.note || v.catatan || null,
                        verified_at: v.created_at || v.tanggal_verifikasi || null,
                        nama_menu,
                        nama_restoran,
                        foto: foto_menu
                    });
                } catch (rowErr) {
                    console.error('[getMenuVerificationHistory] error processing verifikasi row', v && v.id ? v.id : '(unknown)', rowErr && rowErr.stack ? rowErr.stack : rowErr);
                    // skip this row and continue
                    continue;
                }
            }

        // Ensure we have total count from supabase response if available
        const total = typeof resp?.count === 'number' ? resp.count : (Array.isArray(verRows) ? verRows.length : 0);
        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
        if (process.env.NODE_ENV === 'development') {
            console.debug('[getMenuVerificationHistory] returning enriched count=', enriched.length, 'total=', total);
        }
        return res.status(200).json({ success: true, data: enriched, pagination: { page, per_page: perPage, total, total_pages: totalPages } });
    } catch (err) {
        // Log full error for diagnostics
        console.error('getMenuVerificationHistory error', err && err.stack ? err.stack : err);
        // In development include error details in response to help debugging
        if (process.env.NODE_ENV === 'development') {
            return res.status(500).json({ message: 'Gagal mengambil riwayat verifikasi menu.', error: err && err.message ? String(err.message) : String(err) });
        }
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
                const { data: urows } = await supabase.from('users').select('id,role').eq('email', ownerEmail).limit(1);
                if (urows && urows.length) ownerId = urows[0].id;
            }
        }

        // Try phone number
        if (!ownerId && (restaurant.no_telepon || restaurant.phone_admin || restaurant.contact)) {
            const phone = restaurant.no_telepon || restaurant.phone_admin || restaurant.contact;
            const { data: urows } = await supabase.from('users').select('id,role').eq('phone', phone).limit(1);
            if (urows && urows.length) ownerId = urows[0].id;
        }

        // Try owner name (exact match fallback)
        if (!ownerId && restaurant.owner_name) {
            const { data: urows } = await supabase.from('users').select('id,role').eq('name', restaurant.owner_name).limit(1);
            if (urows && urows.length) ownerId = urows[0].id;
        }

        if (!ownerId) {
            console.warn('[setOwnerRoleToPenjual] could not resolve owner user id for restaurant', restaurant && restaurant.id);
            return null;
        }

        // Only update if not already 'penjual'
        const { data: curRows } = await supabase.from('users').select('role').eq('id', ownerId).limit(1);
        const currentRole = curRows && curRows.length ? curRows[0].role : null;
        if (currentRole !== 'penjual') {
            await supabase.from('users').update({ role: 'penjual' }).eq('id', ownerId);
            console.log(`[setOwnerRoleToPenjual] user ${ownerId} role set to 'penjual'`);
        }

        // Ensure restaurant row links to user_id if possible
        if (restaurant.id && Number(restaurant.user_id || 0) !== Number(ownerId)) {
            try {
                await supabase.from('restorans').update({ user_id: ownerId }).eq('id', restaurant.id);
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
    const { status, note } = req.body;

    const dbStatus = mapStatus(status);
    if (!dbStatus) return res.status(400).json({ message: 'Status tidak valid. Gunakan "approved" atau "rejected".' });

    try {
        // Try to update restaurant status (best-effort with fallback)
        const updatePayload = { status_verifikasi: dbStatus, updated_at: new Date().toISOString() };
        if (typeof note !== 'undefined') updatePayload.admin_note = note || null;

        const { data: upd, error: updErr } = await supabase.from('restorans').update(updatePayload).eq('id', id).select('id');
        if (updErr) {
            // fallback to minimal update
            const { data: upd2, error: upd2Err } = await supabase.from('restorans').update({ status_verifikasi: dbStatus }).eq('id', id).select('id');
            if (upd2Err || !upd2 || upd2.length === 0) {
                return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            }
        } else {
            if (!upd || (Array.isArray(upd) && upd.length === 0)) {
                return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
            }
        }

        // Audit log into verifikasi_restoran (non-fatal)
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await supabase.from('verifikasi_restoran').insert({ admin_id: adminId, restoran_id: id, status: dbStatus, catatan: note || null, tanggal_verifikasi: new Date().toISOString() });
        } catch (e) { /* non-fatal */ }

        // Fetch restaurant row via model
        const restaurant = await RestaurantModel.findById(id);

        // Best-effort: set owner role
        if (dbStatus === 'disetujui' && restaurant) {
            try { await setOwnerRoleToPenjual(restaurant); } catch (e) { /* non-fatal */ }
        }

        // Notify owner (notification + email) — best-effort
        try {
            const ownerEmail = restaurant && (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) ? (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) : null;
            if (ownerEmail) {
                let ownerId = null;
                try {
                    const { data: urows } = await supabase.from('users').select('id').eq('email', ownerEmail).limit(1);
                    ownerId = (urows && urows.length && urows[0] && urows[0].id) ? urows[0].id : null;
                } catch (e) { /* ignore */ }

                try {
                    const title = dbStatus === 'disetujui' ? 'Toko Anda Disetujui' : 'Toko Anda Ditolak';
                    const message = note || (dbStatus === 'disetujui' ? 'Admin telah menyetujui toko Anda. Silakan lanjutkan pendaftaran penjual.' : 'Pendaftaran toko Anda ditolak. Mohon periksa dokumen dan ajukan kembali.');
                    const payload = { restaurant_id: restaurant && restaurant.id, status: dbStatus, note: note || null };
                    await NotificationModel.createNotification({ user_id: ownerId, recipient_email: ownerEmail, type: dbStatus === 'disetujui' ? 'success' : 'warning', title, message, data: payload });
                } catch (e) { /* ignore */ }

                try { await sendStoreVerificationEmail(restaurant, ownerEmail, dbStatus, note || ''); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }

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
        const { data: upd, error: updErr } = await supabase.from('menu_makanan').update({ status_verifikasi: dbStatus, updated_at: new Date().toISOString() }).eq('id', id).select('id');
        if (updErr || !upd || upd.length === 0) return res.status(404).json({ message: 'Menu tidak ditemukan.' });

        // Log verifikasi action for menu into verifikasi_menu (non-fatal)
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await supabase.from('verifikasi_menu').insert({ admin_id: adminId, menu_id: id, status: dbStatus, catatan: `Menu status updated by admin ${adminId}`, tanggal_verifikasi: new Date().toISOString() });
        } catch (e) {
            console.warn('Could not insert verifikasi log for menu (non-fatal):', e.message || e);
        }

        const { data: menuRows } = await supabase.from('menu_makanan').select('id,nama_menu,status_verifikasi,restoran_id').eq('id', id).limit(1);
        const menu = menuRows && menuRows.length ? menuRows[0] : null;
        return res.status(200).json({ message: 'Status menu diperbarui.', menu });
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
        // Update status (best-effort)
        const updatePayload = { status_verifikasi: dbStatus, updated_at: new Date().toISOString() };
        if (typeof note !== 'undefined') updatePayload.admin_note = note || null;

        const { data: upd, error: updErr } = await supabase.from('restorans').update(updatePayload).eq('id', id).select('id');
        if (updErr) {
            const { data: upd2, error: upd2Err } = await supabase.from('restorans').update({ status_verifikasi: dbStatus }).eq('id', id).select('id');
            if (upd2Err || !upd2 || upd2.length === 0) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
        } else if (!upd || (Array.isArray(upd) && upd.length === 0)) {
            return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
        }

        // Audit log into verifikasi_restoran
        try {
            const adminId = req.user && req.user.id ? req.user.id : null;
            await supabase.from('verifikasi_restoran').insert({ admin_id: adminId, restoran_id: id, status: dbStatus, catatan: note || null, tanggal_verifikasi: new Date().toISOString() });
        } catch (e) { /* non-fatal */ }

        // Fetch restaurant
        const restaurant = await RestaurantModel.findById(id);

        // Notify owner
        try {
            const ownerEmail = restaurant && (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) ? (restaurant.owner_email || restaurant.email || restaurant.ownerEmail) : null;
            if (ownerEmail) {
                let ownerId = null;
                try {
                    const { data: urows } = await supabase.from('users').select('id').eq('email', ownerEmail).limit(1);
                    ownerId = (urows && urows.length && urows[0] && urows[0].id) ? urows[0].id : null;
                } catch (e) { /* ignore */ }

                try {
                    const title = dbStatus === 'disetujui' ? 'Toko Anda Disetujui' : 'Toko Anda Ditolak';
                    const message = note || (dbStatus === 'disetujui' ? 'Admin telah menyetujui toko Anda. Silakan lanjutkan pendaftaran penjual.' : 'Pendaftaran toko Anda ditolak. Mohon periksa dokumen dan ajukan kembali.');
                    const payload = { restaurant_id: restaurant && restaurant.id, status: dbStatus, note: note || null };
                    await NotificationModel.createNotification({ user_id: ownerId, recipient_email: ownerEmail, type: dbStatus === 'disetujui' ? 'success' : 'warning', title, message, data: payload });
                } catch (e) { /* ignore */ }

                try { await sendStoreVerificationEmailTo(ownerEmail, dbStatus, note || '', restaurant && restaurant.id); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }

        if (dbStatus === 'disetujui' && restaurant) {
            try { await setOwnerRoleToPenjual(restaurant); } catch (e) { /* ignore */ }
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

// DEBUG: GET /admin/verifikasi/debug
// Returns a sample of verifikasi rows and a set of column keys present in the returned rows.
// Protected by adminRoutes (verifyToken + adminMiddleware) in the route.
const getVerifikasiDebug = async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
        // Fetch a sample page from verifikasi_restoran to inspect actual columns
        const { data, error } = await supabase.from('verifikasi_restoran').select('*').order('tanggal_verifikasi', { ascending: false }).limit(limit);
        if (error) {
            console.error('[getVerifikasiDebug] supabase fetch error', error);
            return res.status(500).json({ message: 'Gagal mengambil sample verifikasi.', error: error.message || error });
        }

        const rows = data || [];
        const keys = new Set();
        rows.forEach(r => {
            if (r && typeof r === 'object') Object.keys(r).forEach(k => keys.add(k));
        });

        return res.status(200).json({ sample_count: rows.length, keys: Array.from(keys), rows: rows.slice(0, 20) });
    } catch (err) {
        console.error('[getVerifikasiDebug] error', err && err.stack ? err.stack : err);
        return res.status(500).json({ message: 'Internal server error while reading verifikasi sample.' });
    }
};
// DEV-ONLY: public debug endpoint to inspect `verifikasi` table without auth
const getVerifikasiDebugPublic = async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'development') {
            return res.status(403).json({ message: 'Not allowed' });
        }
        const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
        const { data, error } = await supabase.from('verifikasi_restoran').select('*').order('tanggal_verifikasi', { ascending: false }).limit(limit);
        if (error) {
            console.error('[getVerifikasiDebugPublic] supabase fetch error', error);
            return res.status(500).json({ message: 'Gagal mengambil sample verifikasi.', error: error.message || error });
        }
        const rows = data || [];
        const keys = new Set();
        rows.forEach(r => {
            if (r && typeof r === 'object') Object.keys(r).forEach(k => keys.add(k));
        });
        return res.status(200).json({ sample_count: rows.length, keys: Array.from(keys), rows: rows.slice(0, 20) });
    } catch (err) {
        console.error('[getVerifikasiDebugPublic] error', err && err.stack ? err.stack : err);
        return res.status(500).json({ message: 'Internal server error while reading verifikasi sample.' });
    }
};

// GET /admin/kpi/summary
const getKpiSummary = async (req, res) => {
    try {
        // Use head:true + count:'exact' to get lightweight counts from Supabase
        const pendingR = await supabase.from('restorans').select('id', { count: 'exact', head: true }).in('status_verifikasi', ['pending','menunggu']);
        const pendingM = await supabase.from('menu_makanan').select('id', { count: 'exact', head: true }).in('status_verifikasi', ['pending','menunggu']);
        const activeM = await supabase.from('menu_makanan').select('id', { count: 'exact', head: true }).eq('status_verifikasi', 'disetujui');
        const totalR = await supabase.from('restorans').select('id', { count: 'exact', head: true });
        const totalU = await supabase.from('users').select('id', { count: 'exact', head: true });

        const pendingRestaurants = typeof pendingR.count === 'number' ? pendingR.count : 0;
        const pendingMenus = typeof pendingM.count === 'number' ? pendingM.count : 0;
        const activeMenus = typeof activeM.count === 'number' ? activeM.count : 0;
        const totalRestaurants = typeof totalR.count === 'number' ? totalR.count : 0;
        const totalUsers = typeof totalU.count === 'number' ? totalU.count : 0;

        return res.status(200).json({ success: true, data: { pendingRestaurants, pendingMenus, activeMenus, totalRestaurants, totalUsers } });
    } catch (err) {
        console.error('getKpiSummary error', err);
        return res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan KPI.' });
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
    // KPI summary endpoint
    getKpiSummary,
    getRestaurantVerificationHistory,
    getActiveMenus,
    getMenuVerificationHistory,
    getVerifikasiDebug,
    getVerifikasiDebugPublic,
};

