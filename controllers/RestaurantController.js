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
    // Make create idempotent: if the user already has a restaurant, return it
    // instead of returning an error. This avoids race conditions and improves UX.
    if (existing && existing.length > 0) {
      // Return the most recent one for backward compatibility
      const restaurant = existing.length === 1 ? existing[0] : existing.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      return res.status(200).json({ success: true, message: 'Restoran sudah terdaftar untuk user ini.', data: restaurant });
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
    // helper: upload a local file to Supabase and return public URL (or null)
    const storageHelper = require('../utils/storageHelper');
    const bucket = process.env.SUPABASE_RESTORAN_BUCKET || process.env.SUPABASE_UPLOAD_BUCKET || process.env.SUPABASE_MENU_BUCKET || 'uploads';

    const uploadFile = async (file, subfolder) => {
      if (!file || !file.path) return null;
      try {
        const dest = `${subfolder}/${path.basename(file.path)}`;
        const publicUrl = await storageHelper.uploadFileToBucket(file.path, dest, bucket, { contentType: file.mimetype });
        return publicUrl || null;
      } catch (e) {
        console.warn('uploadFile error', e.message || e);
        return null;
      }
    };

    // Collect arrays from uploaded files (async)
    const collectPaths = async (arr, subfolder) => {
      if (!Array.isArray(arr)) return [];
      const uploads = await Promise.all(arr.map(f => uploadFile(f, subfolder)));
      return uploads.filter(Boolean);
    };

    const fotoArr = await collectPaths(files.foto_ktp || [], `restoran/${id}/foto_ktp`);
    const npwpArr = await collectPaths(files.npwp || [], `restoran/${id}/npwp`);
    const dokumenArr = await collectPaths(files.dokumen_usaha || [], `restoran/${id}/dokumen_usaha`);

    // Profile photo (single file) support: accept field name `foto`
    let fotoProfileUrl = null;
    const fotoField = files.foto;
    if (Array.isArray(fotoField) && fotoField.length) fotoProfileUrl = await uploadFile(fotoField[0], `restoran/${id}/profile`);
    else if (fotoField && fotoField.path) fotoProfileUrl = await uploadFile(fotoField, `restoran/${id}/profile`);

    // If no new uploads for a category, try to reuse existing documents_json or single-file columns
    let existingDocs = null;
    try { existingDocs = existing.documents_json ? JSON.parse(existing.documents_json) : null; } catch (e) { existingDocs = null; }

    // Convert any legacy stored paths to Supabase public URLs where possible
    const storageHelper = require('../utils/storageHelper');
    const toPublic = (v) => {
      if (!v) return null;
      try { return storageHelper.buildPublicUrlFromStoredPath(v) || (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null); } catch (e) { return null; }
    };

    const existingFotos = existingDocs && Array.isArray(existingDocs.foto_ktp) ? existingDocs.foto_ktp.map(toPublic).filter(Boolean) : (existing.foto_ktp ? [toPublic(existing.foto_ktp)].filter(Boolean) : []);
    const existingNpwp = existingDocs && Array.isArray(existingDocs.npwp) ? existingDocs.npwp.map(toPublic).filter(Boolean) : (existing.npwp ? [toPublic(existing.npwp)].filter(Boolean) : []);
    const existingDok = existingDocs && Array.isArray(existingDocs.dokumen_usaha) ? existingDocs.dokumen_usaha.map(toPublic).filter(Boolean) : (existing.dokumen_usaha ? [toPublic(existing.dokumen_usaha)].filter(Boolean) : []);

    const finalFoto = fotoArr.length ? fotoArr : existingFotos;
    const finalNpwp = npwpArr.length ? npwpArr : existingNpwp;
    const finalDokumen = dokumenArr.length ? dokumenArr : existingDok;

    // include profile foto in documents_json under key `profile` for backward compatibility
    const profileFromExistingRaw = (existingDocs && existingDocs.profile) ? existingDocs.profile : (existing.foto || null);
    const profileFromExisting = toPublic(profileFromExistingRaw) || null;
    const profileFinal = fotoProfileUrl || profileFromExisting || null;
    const documentsJson = JSON.stringify({ profile: profileFinal, foto_ktp: finalFoto, npwp: finalNpwp, dokumen_usaha: finalDokumen });

    // For backward-compatibility, keep single-file columns populated with first item (if any)
    const foto_ktp_single = finalFoto.length ? finalFoto[0] : (existing.foto_ktp || null);
    const npwp_single = finalNpwp.length ? finalNpwp[0] : (existing.npwp || null);
    const dokumen_usaha_single = finalDokumen.length ? finalDokumen[0] : (existing.dokumen_usaha || null);

    // Determine foto_path/provider for profile photo (if any)
    const foto_path_val = profileFinal || null;
    let foto_provider_val = null;
    if (foto_path_val) {
      try {
        const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
        if (String(foto_path_val).startsWith('http') && SUPABASE_URL && String(foto_path_val).includes(SUPABASE_URL)) foto_provider_val = 'supabase';
        else if (String(foto_path_val).startsWith('http')) foto_provider_val = 'external';
        else foto_provider_val = null;
      } catch (e) { foto_provider_val = null; }
    }

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
