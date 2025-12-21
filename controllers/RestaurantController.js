const RestaurantModel = require('../models/RestaurantModel');
const supabase = require('../supabase/supabaseClient');
const path = require('path');

// Helper to ensure ownership or admin
function checkOwnership(reqUser, resourceOwnerId) {
  if (!reqUser) return false;
  if (reqUser.role === 'admin') return true;
  return Number(reqUser.id) === Number(resourceOwnerId);
}

const create = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { nama_restoran, alamat } = req.body;
    if (!nama_restoran || !alamat) return res.status(400).json({ success: false, message: 'Field nama_restoran dan alamat wajib.' });

    // Enforce rule: 1 user may only have 1 restaurant
    const existing = await RestaurantModel.findByUserId(userId);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User hanya boleh memiliki 1 toko/restoran.' });
    }

    const restaurant = await RestaurantModel.createStep1({ nama_restoran, alamat, user_id: userId });
    return res.status(201).json({ success: true, message: 'Restoran dibuat (step 1).', data: restaurant });
  } catch (error) {
    console.error('create restaurant error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const updateStep2 = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ success: false, message: 'Akses ditolak: bukan pemilik.' });
    // Extract fields (supporting new columns)
    const {
      nama_restoran, alamat, deskripsi, latitude, longitude, no_telepon, jenis_usaha, mapsLatLong,
      maps_link, mapsLink,
      owner_name, owner_email, phone_admin, operating_hours, sales_channels, social_media,
      store_category, commitment_checked, health_focus, dominant_cooking_method,
      dominant_fat, slug
    } = req.body || {};

    // Parse lat/lng if mapsLatLong provided or if separate values present
    let lat = latitude;
    let lng = longitude;
    // Try to parse coordinates from any maps field provided (mapsLatLong, maps_link, mapsLink)
    const candidateMaps = mapsLatLong || maps_link || mapsLink || null;
    if ((!lat || !lng) && candidateMaps) {
      const parts = String(candidateMaps || '').split(',').map(s => s.trim());
      if (parts.length === 2) {
        lat = parseFloat(parts[0]) || null;
        lng = parseFloat(parts[1]) || null;
      }
    }

    // Normalize jenis_usaha to lowercase to match DB enum
    const jenisUsahaNormalized = typeof jenis_usaha === 'string' ? jenis_usaha.toLowerCase() : jenis_usaha;

    // Ensure JSON fields are strings when saving (safe stringify)
    const safeStringify = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v); } catch (e) { return null; }
    };

    const healthFocusStr = safeStringify(health_focus);
    const dominantCookingStr = safeStringify(dominant_cooking_method);

    const updated = await RestaurantModel.updateStep2(id, {
      nama_restoran,
      alamat,
      deskripsi,
      latitude: lat,
      longitude: lng,
      no_telepon,
      jenis_usaha: jenisUsahaNormalized,
      owner_name,
      owner_email,
      phone_admin,
      operating_hours,
      sales_channels,
      social_media,
      store_category,
      commitment_checked: commitment_checked ? 1 : 0,
      health_focus: healthFocusStr,
      dominant_cooking_method: dominantCookingStr,
      dominant_fat,
      maps_latlong: mapsLatLong || null,
      maps_link: maps_link || mapsLink || null,
      slug: slug || null
    });

    return res.json({ success: true, message: 'Step 2 disimpan.', data: updated });
  } catch (error) {
    console.error('updateStep2 error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const updateStep3 = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ success: false, message: 'Akses ditolak: bukan pemilik.' });
    // Support multi-file uploads and store as JSON arrays under `documents_json`.
    // Expected upload fields: foto_ktp (array), npwp (array), dokumen_usaha (array)
    const files = req.files || {};
    const buildUrl = (file) => file ? `/uploads/restoran/${path.basename(file.path)}` : null;

    // Collect arrays from uploaded files
    const collectPaths = (arr) => Array.isArray(arr) ? arr.map(f => buildUrl(f)).filter(Boolean) : [];

    const fotoArr = collectPaths(files.foto_ktp);
    const npwpArr = collectPaths(files.npwp);
    const dokumenArr = collectPaths(files.dokumen_usaha);

    // Profile photo (single file) support: accept field name `foto`
    let fotoProfileUrl = null;
    const fotoField = files.foto;
    if (Array.isArray(fotoField) && fotoField.length) fotoProfileUrl = buildUrl(fotoField[0]);
    else if (fotoField && fotoField.path) fotoProfileUrl = buildUrl(fotoField);

    // If no new uploads for a category, try to reuse existing documents_json or single-file columns
    let existingDocs = null;
    try { existingDocs = existing.documents_json ? JSON.parse(existing.documents_json) : null; } catch (e) { existingDocs = null; }

    const finalFoto = fotoArr.length ? fotoArr : (existingDocs && Array.isArray(existingDocs.foto_ktp) ? existingDocs.foto_ktp : (existing.foto_ktp ? [existing.foto_ktp] : []));
    const finalNpwp = npwpArr.length ? npwpArr : (existingDocs && Array.isArray(existingDocs.npwp) ? existingDocs.npwp : (existing.npwp ? [existing.npwp] : []));
    const finalDokumen = dokumenArr.length ? dokumenArr : (existingDocs && Array.isArray(existingDocs.dokumen_usaha) ? existingDocs.dokumen_usaha : (existing.dokumen_usaha ? [existing.dokumen_usaha] : []));

    // include profile foto in documents_json under key `profile` for backward compatibility
    const profileFromExisting = (existingDocs && existingDocs.profile) ? existingDocs.profile : (existing.foto || null);
    const profileFinal = fotoProfileUrl || profileFromExisting || null;
    const documentsJson = JSON.stringify({ profile: profileFinal, foto_ktp: finalFoto, npwp: finalNpwp, dokumen_usaha: finalDokumen });

    // For backward-compatibility, keep single-file columns populated with first item (if any)
    const foto_ktp_single = finalFoto.length ? finalFoto[0] : (existing.foto_ktp || null);
    const npwp_single = finalNpwp.length ? finalNpwp[0] : (existing.npwp || null);
    const dokumen_usaha_single = finalDokumen.length ? finalDokumen[0] : (existing.dokumen_usaha || null);

    // Determine foto_path/provider for profile photo (if any)
    const foto_path_val = profileFinal || null;
    const foto_provider_val = foto_path_val && String(foto_path_val).startsWith('/uploads') ? 'local' : (foto_path_val ? 'external' : null);

    const updated = await RestaurantModel.updateStep3(id, {
      foto_ktp: foto_ktp_single,
      npwp: npwp_single,
      dokumen_usaha: dokumen_usaha_single,
      documents_json: documentsJson,
      foto_path: foto_path_val,
      foto_storage_provider: foto_provider_val
    });

    return res.json({ success: true, message: 'Dokumen diunggah.', data: updated });
  } catch (error) {
    console.error('updateStep3 error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const submitFinal = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ success: false, message: 'Akses ditolak: bukan pemilik.' });

    const updated = await RestaurantModel.submitFinal(id);
    // Try to write a verifikasi record for audit trail using expected column names
    try {
      await supabase.from('verifikasi_restoran').insert({ admin_id: null, restoran_id: id, status: 'pending', catatan: 'Pengajuan pendaftaran dikirim', tanggal_verifikasi: new Date().toISOString() });
    } catch (err) {
      // Log and continue — target table might differ in some environments
      console.warn('Could not insert verifikasi_restoran record (non-fatal):', err.message || err);
    }

    return res.json({ success: true, message: 'Pengajuan pendaftaran dikirim untuk verifikasi admin.', data: updated });
  } catch (error) {
    console.error('submitFinal error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getById = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await RestaurantModel.findById(id);
    if (!data) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('getById error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getByUserId = async (req, res) => {
  try {
    const userId = req.params.userId || (req.user && req.user.id);
    const rows = await RestaurantModel.findByUserId(userId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getByUserId error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// GET /api/my-store
const getMyStore = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Fetch the single restaurant for this user.
    // Note: legacy data may contain >1 restaurant per user — in that case we choose the MOST RECENT one.
    // This preserves backward-compatibility while enforcing 1 user = 1 store behavior in the API layer.
    const restaurant = await RestaurantModel.findLatestByUserId(userId);
    if (!restaurant) {
      return res.json({ success: true, restaurant: null, menus: [], menuStats: { totalMenu: 0, pending: 0, approved: 0, rejected: 0 } });
    }

    // Fetch menus for this restaurant
    const MenuModel = require('../models/MenuModel');
    const menus = await MenuModel.findByRestaurantId(restaurant.id);

    // Build menuStats
    const stats = { totalMenu: 0, pending: 0, approved: 0, rejected: 0 };
    stats.totalMenu = Array.isArray(menus) ? menus.length : 0;
    menus.forEach(m => {
      const st = (m.status_verifikasi || '').toLowerCase();
      if (st === 'pending') stats.pending += 1;
      else if (st === 'disetujui' || st === 'approved') stats.approved += 1;
      else if (st === 'ditolak' || st === 'rejected') stats.rejected += 1;
    });

    return res.json({ success: true, restaurant, menus, menuStats: stats });
  } catch (error) {
    console.error('getMyStore error', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data toko', error: error.message });
  }
};

const getAll = async (req, res) => {
  try {
    const rows = await RestaurantModel.findAll();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getAll error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = {
  create,
  updateStep2,
  updateStep3,
  submitFinal,
  getById,
  getByUserId,
  getMyStore,
  getAll
};

// Get restaurant by slug (friendly URL) and include its approved menus
const getBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) return res.status(400).json({ success: false, message: 'slug required' });
    const restaurant = await RestaurantModel.findBySlug(slug);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });

    // Fetch approved menus for this restaurant
    const MenuModel = require('../models/MenuModel');
    const menus = await MenuModel.findByRestaurantId(restaurant.id || restaurant.id);

    return res.json({ success: true, data: { restaurant, menus } });
  } catch (error) {
    console.error('getBySlug error', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data restoran.' });
  }
};

// expose new method
module.exports.getBySlug = getBySlug;
