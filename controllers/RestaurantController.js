const RestaurantModel = require('../models/RestaurantModel');
const db = require('../config/db');
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
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { nama_restoran, alamat } = req.body;
    if (!nama_restoran || !alamat) return res.status(400).json({ message: 'Field nama_restoran dan alamat wajib.' });

    const restaurant = await RestaurantModel.createStep1({ nama_restoran, alamat, user_id: userId });
    return res.status(201).json({ message: 'Restoran dibuat (step 1).', data: restaurant });
  } catch (error) {
    console.error('create restaurant error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const updateStep2 = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ message: 'Akses ditolak: bukan pemilik.' });
    // Extract fields (supporting new columns)
    const {
      deskripsi, latitude, longitude, no_telepon, jenis_usaha, mapsLatLong,
      owner_name, owner_email, phone_admin, operating_hours, sales_channels, social_media,
      store_category, commitment_checked, health_focus, dominant_cooking_method,
      dominant_fat, slug
    } = req.body || {};

    // Parse lat/lng if mapsLatLong provided or if separate values present
    let lat = latitude;
    let lng = longitude;
    if ((!lat || !lng) && mapsLatLong) {
      const parts = String(mapsLatLong || '').split(',').map(s => s.trim());
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
      slug: slug || null
    });

    return res.json({ message: 'Step 2 disimpan.', data: updated });
  } catch (error) {
    console.error('updateStep2 error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const updateStep3 = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ message: 'Akses ditolak: bukan pemilik.' });
    // Support multi-file uploads and store as JSON arrays under `documents_json`.
    // Expected upload fields: foto_ktp (array), npwp (array), dokumen_usaha (array)
    const files = req.files || {};
    const buildUrl = (file) => file ? `/uploads/restoran/${path.basename(file.path)}` : null;

    // Collect arrays from uploaded files
    const collectPaths = (arr) => Array.isArray(arr) ? arr.map(f => buildUrl(f)).filter(Boolean) : [];

    const fotoArr = collectPaths(files.foto_ktp);
    const npwpArr = collectPaths(files.npwp);
    const dokumenArr = collectPaths(files.dokumen_usaha);

    // If no new uploads for a category, try to reuse existing documents_json or single-file columns
    let existingDocs = null;
    try { existingDocs = existing.documents_json ? JSON.parse(existing.documents_json) : null; } catch (e) { existingDocs = null; }

    const finalFoto = fotoArr.length ? fotoArr : (existingDocs && Array.isArray(existingDocs.foto_ktp) ? existingDocs.foto_ktp : (existing.foto_ktp ? [existing.foto_ktp] : []));
    const finalNpwp = npwpArr.length ? npwpArr : (existingDocs && Array.isArray(existingDocs.npwp) ? existingDocs.npwp : (existing.npwp ? [existing.npwp] : []));
    const finalDokumen = dokumenArr.length ? dokumenArr : (existingDocs && Array.isArray(existingDocs.dokumen_usaha) ? existingDocs.dokumen_usaha : (existing.dokumen_usaha ? [existing.dokumen_usaha] : []));

    const documentsJson = JSON.stringify({ foto_ktp: finalFoto, npwp: finalNpwp, dokumen_usaha: finalDokumen });

    // For backward-compatibility, keep single-file columns populated with first item (if any)
    const foto_ktp_single = finalFoto.length ? finalFoto[0] : (existing.foto_ktp || null);
    const npwp_single = finalNpwp.length ? finalNpwp[0] : (existing.npwp || null);
    const dokumen_usaha_single = finalDokumen.length ? finalDokumen[0] : (existing.dokumen_usaha || null);

    const updated = await RestaurantModel.updateStep3(id, {
      foto_ktp: foto_ktp_single,
      npwp: npwp_single,
      dokumen_usaha: dokumen_usaha_single,
      documents_json: documentsJson
    });

    return res.json({ message: 'Dokumen diunggah.', data: updated });
  } catch (error) {
    console.error('updateStep3 error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const submitFinal = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await RestaurantModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });

    if (!checkOwnership(req.user, existing.user_id)) return res.status(403).json({ message: 'Akses ditolak: bukan pemilik.' });

    const updated = await RestaurantModel.submitFinal(id);
    // Try to write a verifikasi record for audit trail using expected column names
    try {
      await db.execute(
        'INSERT INTO verifikasi (admin_id, tipe_objek, objek_id, status, catatan, tanggal_verifikasi) VALUES (?, ?, ?, ?, ?, NOW())',
        [null, 'restoran', id, 'pending', 'Pengajuan pendaftaran dikirim']
      );
    } catch (err) {
      // Log and continue — verifikasi table might differ in some environments
      console.warn('Could not insert verifikasi record (non-fatal):', err.message || err);
    }

    return res.json({ message: 'Pengajuan pendaftaran dikirim untuk verifikasi admin.', data: updated });
  } catch (error) {
    console.error('submitFinal error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getById = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await RestaurantModel.findById(id);
    if (!data) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
    return res.json({ data });
  } catch (error) {
    console.error('getById error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getByUserId = async (req, res) => {
  try {
    const userId = req.params.userId || (req.user && req.user.id);
    const rows = await RestaurantModel.findByUserId(userId);
    return res.json({ data: rows });
  } catch (error) {
    console.error('getByUserId error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getAll = async (req, res) => {
  try {
    const rows = await RestaurantModel.findAll();
    return res.json({ data: rows });
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
  getAll
};
