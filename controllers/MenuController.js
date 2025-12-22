const MenuModel = require('../models/MenuModel');
const RestaurantModel = require('../models/RestaurantModel');
const path = require('path');
const fs = require('fs');
const supabase = require('../supabase/supabaseClient');
const { syncMenuBahan, syncMenuDietClaims } = require('../utils/pivotHelper');
const menuCreateController = require('./MenuCreateController');

const list = async (req, res) => {
  try {
    // Return only approved menus for public listing
    const rows = await (MenuModel.findAllApproved ? MenuModel.findAllApproved() : MenuModel.findAll());
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('menu list error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar menu.' });
  }
};

const getFeatured = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const rows = await MenuModel.getFeaturedMenus(limit);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getFeatured error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil featured menus.' });
  }
};

const search = async (req, res) => {
  try {
    const q = req.query.q || null;
    const categoryId = req.query.category_id || null;
    const rows = await MenuModel.searchAndFilter(q, categoryId, null, 50);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('search error', err);
    return res.status(500).json({ success: false, message: 'Gagal mencari menu.' });
  }
};

const getByCategory = async (req, res) => {
  try {
    const key = req.params.key;
    const limit = Number(req.query.limit) || 8;
    if (!key) return res.status(400).json({ success: false, message: 'Category key required' });
    console.log(`[MenuController.getByCategory] requested key='${key}', limit=${limit}`);
    const rows = await (MenuModel.findByDietClaim ? MenuModel.findByDietClaim(key, limit) : []);
    console.log(`[MenuController.getByCategory] result count for key='${key}': ${Array.isArray(rows) ? rows.length : 0}`);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getByCategory error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil menu berdasarkan kategori.' });
  }
};

const getById = async (req, res) => {
  try {
    const id = req.params.id;
    const menu = await MenuModel.findById(id);
    if (!menu) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    return res.json({ success: true, data: menu });
  } catch (err) {
    console.error('getById error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail menu.' });
  }
};

const getBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    console.log('[DEBUG getBySlug] slug:', slug);
    const menu = await MenuModel.findBySlug(slug);
    console.log('[DEBUG getBySlug] menu fetched:', menu ? { id: menu.id, nama_menu: menu.nama_menu, diet_claims: menu.diet_claims } : null);
    if (!menu) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    return res.json({ success: true, data: menu });
  } catch (err) {
    console.error('getBySlug error', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail menu.' });
  }
};

const createMenu = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!(user.role === 'penjual' || user.role === 'admin')) return res.status(403).json({ success: false, message: 'Akses ditolak: hanya penjual yang dapat menambah menu.' });

    // Debug: log incoming body and file for troubleshooting missing fields
    console.log('[DEBUG createMenu] req.user:', user ? { id: user.id, role: user.role } : null);
    console.log('[DEBUG createMenu] req.body keys:', Object.keys(req.body || {}));
    console.log('[DEBUG createMenu] req.body sample:', req.body);
    console.log('[DEBUG createMenu] req.file:', req.file ? { fieldname: req.file.fieldname, path: req.file.path, originalname: req.file.originalname, size: req.file.size } : null);

    const body = req.body || {};
    const file = req.file || null;

    // Server-side validation: required fields
    const missing = [];
    if (!body.restoran_id) missing.push('restoran_id');
    if (!body.kategori_id) missing.push('kategori_id');
    if (!body.nama_menu) missing.push('nama_menu');
    if (!body.harga) missing.push('harga');
    // foto is required per client requirement
    if (!file) missing.push('foto');

    if (missing.length) {
      console.warn('[DEBUG createMenu] Missing required fields:', missing);
      return res.status(400).json({ success: false, message: `Field wajib hilang: ${missing.join(', ')}` });
    }

    const restoran_id = body.restoran_id;
    if (!restoran_id) return res.status(400).json({ success: false, message: 'restoran_id wajib.' });

    const restoran = await RestaurantModel.findById(restoran_id);
    if (!restoran) return res.status(404).json({ success: false, message: 'Restoran tidak ditemukan.' });
    if (Number(restoran.user_id) !== Number(user.id) && user.role !== 'admin') return res.status(403).json({ success: false, message: 'Akses ditolak: bukan pemilik restoran.' });
    if (restoran.status_verifikasi !== 'disetujui') return res.status(403).json({ success: false, message: 'Restoran belum diverifikasi oleh admin.' });

    // Prepare menu data
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
      foto: null
    };

    if (file) {
      const rel = `/uploads/menu/${path.basename(file.path)}`;
      menuData.foto = rel;
      menuData.foto_path = rel;
      menuData.foto_storage_provider = 'local';

      // Try Supabase backup upload (optional) so production with ephemeral FS still serves images
      try {
        const bucket = process.env.SUPABASE_MENU_BUCKET || 'menu';
        const storagePath = `menu/${restoran_id}/${path.basename(file.path)}`;
        const buffer = fs.readFileSync(file.path);
        const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
          contentType: file.mimetype,
          upsert: true
        });
        if (!uploadError) {
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          if (publicData && publicData.publicUrl) {
            menuData.foto_path = publicData.publicUrl;
            menuData.foto_storage_provider = 'supabase';
            console.log('[INFO] Supabase menu image uploaded:', publicData.publicUrl);
          }
        } else {
          console.warn('[INFO] Supabase menu upload failed:', uploadError.message || uploadError);
        }
      } catch (e) {
        console.warn('[INFO] Supabase menu upload error, continuing with local path:', e.message || e);
      }
    }

    if (!menuData.nama_menu) return res.status(400).json({ success: false, message: 'nama_menu wajib.' });

    const created = await MenuModel.create(menuData);
    if (!created || !created.id) return res.status(500).json({ success: false, message: 'Gagal membuat menu.' });

    // Sync pivots
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
    } catch (syncErr) { console.warn('Pivot sync warning', syncErr); }

    const full = await MenuModel.getMenuDetail(created.id);
    return res.status(201).json({ success: true, data: full });
  } catch (err) {
    console.error('createMenu error', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat membuat menu.' });
  }
};

const deleteMenu = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'menu id is required' });

    // fetch row to validate ownership
    const row = await MenuModel.getMenuDetailById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });

    // owner or admin only
    if (user.role !== 'admin') {
      // fetch restaurant owner
      const restoran = await RestaurantModel.findById(row.restoran_id || row.restoranId || row.restoran_id);
      if (!restoran) return res.status(403).json({ success: false, message: 'Akses ditolak.' });
      if (Number(restoran.user_id) !== Number(user.id)) return res.status(403).json({ success: false, message: 'Akses ditolak: bukan pemilik menu.' });
    }

    // delete pivots first (best-effort)
    try {
      const supabase = require('../supabase/supabaseClient');
      await supabase.from('menu_bahan_baku').delete().eq('menu_id', id);
      await supabase.from('menu_diet_claims').delete().eq('menu_id', id);
      // also remove verifikasi records and reviews + review photos to avoid FK constraint errors
      try {
        await supabase.from('verifikasi_menu').delete().eq('menu_id', id);
      } catch (e) { console.warn('failed to delete verifikasi_menu rows', e); }
      try {
        // fetch ulasan ids for this menu to clean up review_photos
        const { data: ulasanRows } = await supabase.from('ulasan').select('id').eq('menu_id', id);
        const ulasanIds = (ulasanRows || []).map(r => r.id).filter(Boolean);
        if (ulasanIds.length) {
          await supabase.from('review_photos').delete().in('ulasan_id', ulasanIds);
        }
        // delete the ulasan rows
        await supabase.from('ulasan').delete().eq('menu_id', id);
      } catch (e) { console.warn('failed to clean ulasan/review_photos', e); }
    } catch (e) { console.warn('failed to clean pivots', e); }

    // delete menu
    const deleted = await MenuModel.deleteMenu(id);
    return res.json({ success: true, message: 'Menu berhasil dihapus.' });
  } catch (err) {
    console.error('deleteMenu error', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus menu.' });
  }
};

module.exports = { list, getById, getBySlug, createMenu, getFeatured, search, getByCategory, updateMenu: menuCreateController.updateMenu, deleteMenu };