const MenuModel = require('../models/MenuModel');
const RestaurantModel = require('../models/RestaurantModel');
const path = require('path');
const { syncMenuBahan, syncMenuDietClaims } = require('../utils/pivotHelper');
const supabase = require('../supabase/supabaseClient');
const storageHelper = require('../utils/storageHelper');

const createMenu = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // only penjual (seller) or admin allowed
    if (!(user.role === 'penjual' || user.role === 'admin')) {
      return res.status(403).json({ message: 'Akses ditolak: hanya penjual yang boleh menambah menu.' });
    }

    // Expecting multipart/form-data
    const body = req.body || {};
    const fotoFile = req.file || null; // middleware uses single('foto')

    const restoran_id = body.restoran_id;
    if (!restoran_id) return res.status(400).json({ message: 'restoran_id wajib.' });

    // Check restoran ownership and verification
    const restoran = await RestaurantModel.findById(restoran_id);
    if (!restoran) return res.status(404).json({ message: 'Restoran tidak ditemukan.' });
    if (Number(restoran.user_id) !== Number(user.id) && user.role !== 'admin') {
      return res.status(403).json({ message: 'Akses ditolak: bukan pemilik restoran.' });
    }
    if (restoran.status_verifikasi !== 'disetujui') {
      return res.status(403).json({ message: 'Restoran belum diverifikasi oleh admin.' });
    }

    // Build menu data (no legacy columns)
    const menuData = {
      restoran_id: restoran_id,
      kategori_id: body.kategori_id || null,
      nama_menu: body.nama_menu,
      deskripsi: body.deskripsi || null,
      metode_masak: body.metode_masak || null,
      kalori: (typeof body.kalori !== 'undefined' && body.kalori !== '') ? Number(body.kalori) : null,
      protein: (typeof body.protein !== 'undefined' && body.protein !== '') ? Number(body.protein) : null,
      gula: (typeof body.gula !== 'undefined' && body.gula !== '') ? Number(body.gula) : null,
      lemak: (typeof body.lemak !== 'undefined' && body.lemak !== '') ? Number(body.lemak) : null,
      serat: (typeof body.serat !== 'undefined' && body.serat !== '') ? Number(body.serat) : null,
      lemak_jenuh: (typeof body.lemak_jenuh !== 'undefined' && body.lemak_jenuh !== '') ? Number(body.lemak_jenuh) : null,
      karbohidrat: (typeof body.karbohidrat !== 'undefined' && body.karbohidrat !== '') ? Number(body.karbohidrat) : null,
      kolesterol: (typeof body.kolesterol !== 'undefined' && body.kolesterol !== '') ? Number(body.kolesterol) : null,
      natrium: (typeof body.natrium !== 'undefined' && body.natrium !== '') ? Number(body.natrium) : null,
      harga: body.harga ? Number(body.harga) : 0,
      // New storage columns
      foto: null,
      foto_path: null,
      foto_storage_provider: null
    };

    if (fotoFile) {
      // Try to upload to Supabase storage and store the public URL.
      try {
        const bucket = process.env.SUPABASE_MENU_BUCKET || process.env.SUPABASE_UPLOAD_BUCKET || 'uploads';
        const dest = `menu/${restoran_id}/${path.basename(fotoFile.path)}`;
        const publicUrl = await storageHelper.uploadFileToBucket(fotoFile.path, dest, bucket, { contentType: fotoFile.mimetype });
        if (publicUrl) {
          menuData.foto = null;
          menuData.foto_path = publicUrl;
          menuData.foto_storage_provider = 'supabase';
        } else {
          // If upload fails unexpectedly, leave fields null to avoid serving local /uploads
          menuData.foto = null;
          menuData.foto_path = null;
          menuData.foto_storage_provider = null;
        }
      } catch (e) {
        console.warn('Supabase upload failed for menu image, skipping:', e.message || e);
        menuData.foto = null;
        menuData.foto_path = null;
        menuData.foto_storage_provider = null;
      }
    }

    // Validate required
    if (!menuData.nama_menu) return res.status(400).json({ message: 'nama_menu wajib.' });

    const created = await MenuModel.create(menuData);
    if (!created || !created.id) return res.status(500).json({ message: 'Gagal membuat menu.' });

    // Sync pivots: bahan_baku and diet_claims. Accept arrays or comma/JSON strings
    const bahanInput = body.bahan_baku || body.bahan || body.ingredients || null;
    const dietInput = body.diet_claims || body.diet || null;

    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch (e) { return String(val).split(',').map(s => s.trim()).filter(Boolean); }
    };

    try {
      await Promise.all([
        syncMenuBahan(created.id, parseList(bahanInput)),
        syncMenuDietClaims(created.id, parseList(dietInput))
      ]);
    } catch (syncErr) {
      console.warn('Pivot sync warning', syncErr);
    }

    // Return expanded object
    const full = await MenuModel.getMenuDetail(created.id);
    return res.status(201).json({ message: 'Menu berhasil dibuat (pending verifikasi).', data: full });
  } catch (error) {
    console.error('createMenu error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan saat membuat menu.' });
  }
};

const listMenus = async (req, res) => {
  try {
    const rows = await MenuModel.findAll();
    return res.json({ data: rows });
  } catch (error) {
    console.error('listMenus error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan saat mengambil daftar menu.' });
  }
};

module.exports = { createMenu, listMenus };

// Update menu endpoint: validates, updates allowed fields, syncs pivots, returns expanded menu
const updateMenu = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: true, message: 'Unauthorized' });

    const menuId = Number(req.params.id || req.body.id);
    if (!menuId) return res.status(400).json({ error: true, message: 'menu id is required' });

    // Fetch existing menu
    const existing = await supabase.from('menu_makanan').select('*').eq('id', menuId).limit(1).single();
    if (!existing || !existing.data) return res.status(404).json({ error: true, message: 'Menu tidak ditemukan.' });
    const menuRow = existing.data;

    // Authorization: owner or admin
    if (user.role !== 'admin') {
      // menuRow.restoran_id is the restaurant id; need to verify the restaurant's owner user_id
      const { data: restoranRow, error: rErr } = await supabase.from('restorans').select('id,user_id').eq('id', menuRow.restoran_id).limit(1).single();
      if (rErr || !restoranRow) {
        console.warn('updateMenu: failed to lookup restaurant owner', rErr);
        return res.status(403).json({ error: true, message: 'Akses ditolak: bukan pemilik menu.' });
      }
      // Debug: log the current user id and the restaurant owner id to help diagnose auth issues
      try { console.debug('updateMenu: current user id=', user.id, 'restaurant.user_id=', restoranRow.user_id, 'menu.restoran_id=', menuRow.restoran_id); } catch (e) {}
      if (Number(restoranRow.user_id) !== Number(user.id)) {
        console.warn('updateMenu: ownership mismatch', { currentUser: user.id, ownerId: restoranRow.user_id, restoranId: restoranRow.id });
        return res.status(403).json({ error: true, message: 'Akses ditolak: bukan pemilik menu.' });
      }
    }

    const body = req.body || {};

    // Validate numeric fields
    const numericFields = ['kalori','protein','gula','lemak','serat','lemak_jenuh','karbohidrat','kolesterol','natrium','harga','kategori_id'];
    const payload = {};
    for (const nf of numericFields) {
      if (typeof body[nf] !== 'undefined' && body[nf] !== null && body[nf] !== '') {
        const v = Number(body[nf]);
        if (Number.isNaN(v)) return res.status(400).json({ error: true, message: `Field ${nf} harus numerik.` });
        payload[nf] = v;
      }
    }
    // Other allowed string fields
    const allowedStrings = ['nama_menu','deskripsi','metode_masak','foto','foto_path','foto_storage_provider','status_verifikasi'];
    for (const s of allowedStrings) if (typeof body[s] !== 'undefined') payload[s] = body[s];

    // Optional: validate kategori existence
    if (payload.kategori_id) {
      const { data: krows, error: kerr } = await supabase.from('kategori_makanan').select('id').eq('id', payload.kategori_id).limit(1);
      if (kerr) { console.warn('kategori lookup failed', kerr); }
      if (!krows || !krows.length) return res.status(400).json({ error: true, message: 'kategori_id tidak ditemukan.' });
    }

    // Update menu row
    const updated = await MenuModel.updateMenu(menuId, payload);

    // Sync pivots if provided
    const parseList = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch (e) { return String(val).split(',').map(s => s.trim()).filter(Boolean); }
    };

    const bahanInput = body.bahan_baku || body.bahan || body.ingredients || null;
    const dietInput = body.diet_claims || body.diet || null;

    try {
      await Promise.all([
        syncMenuBahan(menuId, parseList(bahanInput)),
        syncMenuDietClaims(menuId, parseList(dietInput))
      ]);
    } catch (syncErr) {
      console.warn('Pivot sync warning on update', syncErr);
    }

    // fetch expanded object and return
    const full = await MenuModel.getMenuDetailById(menuId);
    return res.status(200).json({ error: false, message: 'Menu updated', data: full });
  } catch (err) {
    console.error('updateMenu error', err);
    return res.status(500).json({ error: true, message: 'Gagal memperbarui menu.' });
  }
};

module.exports = { createMenu, listMenus, updateMenu };
