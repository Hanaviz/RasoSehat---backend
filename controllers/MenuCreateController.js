const MenuModel = require('../models/MenuModel');
const RestaurantModel = require('../models/RestaurantModel');
const path = require('path');

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

    // Build menu data
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

    // diet_claims: accept JSON string or comma-separated list
    if (body.diet_claims) {
      try {
        if (typeof body.diet_claims === 'string') {
          const parsed = JSON.parse(body.diet_claims);
          menuData.diet_claims = Array.isArray(parsed) ? JSON.stringify(parsed) : JSON.stringify([parsed]);
        } else {
          menuData.diet_claims = JSON.stringify(body.diet_claims);
        }
      } catch (e) {
        // fallback: comma separated
        const arr = body.diet_claims.split(',').map(s => s.trim()).filter(Boolean);
        menuData.diet_claims = JSON.stringify(arr);
      }
    } else {
      menuData.diet_claims = JSON.stringify([]);
    }

    if (fotoFile) {
      menuData.foto = `/uploads/menu/${path.basename(fotoFile.path)}`;
    }

    // Validate required
    if (!menuData.nama_menu) return res.status(400).json({ message: 'nama_menu wajib.' });

    const created = await MenuModel.create(menuData);
    return res.status(201).json({ message: 'Menu berhasil dibuat (pending verifikasi).', data: created });
  } catch (error) {
    console.error('createMenu error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan saat membuat menu.' });
  }
};

const listMenus = async (req, res) => {
  try {
    const rows = await MenuModel.findAll();
    // parse diet_claims safely
    const safe = rows.map(r => ({ ...r, diet_claims: JSON.parse(r.diet_claims || '[]') }));
    return res.json({ data: safe });
  } catch (error) {
    console.error('listMenus error', error);
    return res.status(500).json({ message: 'Terjadi kesalahan saat mengambil daftar menu.' });
  }
};

module.exports = { createMenu, listMenus };
