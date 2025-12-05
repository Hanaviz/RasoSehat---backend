const MenuModel = require('../models/MenuModel');
const RestaurantModel = require('../models/RestaurantModel');
const path = require('path');

const list = async (req, res) => {
  try {
    const rows = await MenuModel.findAll();
    // MenuModel.findAll already returns diet_claims as parsed array
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
    return res.json({ success: true, data: rows.map(r => ({ ...r, diet_claims: JSON.parse(r.diet_claims || '[]') })) });
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
    return res.json({ success: true, data: rows.map(r => ({ ...r, diet_claims: JSON.parse(r.diet_claims || '[]') })) });
  } catch (err) {
    console.error('search error', err);
    return res.status(500).json({ success: false, message: 'Gagal mencari menu.' });
  }
};

const getById = async (req, res) => {
  try {
    const id = req.params.id;
    const menu = await MenuModel.findById(id);
    if (!menu) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    menu.diet_claims = JSON.parse(menu.diet_claims || '[]');
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
    menu.diet_claims = JSON.parse(menu.diet_claims || '[]');
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
    console.log('[DEBUG createMenu] req.file:', req.file ? { fieldname: req.file.fieldname, path: req.file.path, originalname: req.file.originalname } : null);

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
      bahan_baku: body.bahan_baku || null,
      metode_masak: body.metode_masak || null,
      diet_claims: null,
      kalori: body.kalori ? Number(body.kalori) : 0,
      protein: body.protein ? Number(body.protein) : 0,
      gula: body.gula ? Number(body.gula) : 0,
      lemak: body.lemak ? Number(body.lemak) : 0,
      serat: body.serat ? Number(body.serat) : 0,
      lemak_jenuh: body.lemak_jenuh ? Number(body.lemak_jenuh) : 0,
      harga: body.harga ? Number(body.harga) : 0,
      foto: null
    };

    if (body.diet_claims) {
      try {
        const parsed = typeof body.diet_claims === 'string' ? JSON.parse(body.diet_claims) : body.diet_claims;
        menuData.diet_claims = JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        const arr = String(body.diet_claims).split(',').map(s => s.trim()).filter(Boolean);
        menuData.diet_claims = JSON.stringify(arr);
      }
    } else {
      menuData.diet_claims = JSON.stringify([]);
    }

    if (file) {
      menuData.foto = `/uploads/menu/${path.basename(file.path)}`;
    }

    if (!menuData.nama_menu) return res.status(400).json({ success: false, message: 'nama_menu wajib.' });

    const created = await MenuModel.createMenu(menuData);
    if (!created) return res.status(500).json({ success: false, message: 'Gagal membuat menu.' });
    created.diet_claims = JSON.parse(created.diet_claims || '[]');
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('createMenu error', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat membuat menu.' });
  }
};

module.exports = { list, getById, getBySlug, createMenu, getFeatured, search };