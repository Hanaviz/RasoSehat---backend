const ReviewModel = require('../models/ReviewModel');
const supabase = require('../supabase/supabaseClient');
const path = require('path');

// Tambah ulasan
const tambahUlasan = async (req, res) => {
  try {
    const { menu_id, rating, komentar } = req.body;
    const user_id = req.user.id; // dari authmiddleware

    // Validasi
    if (!menu_id || !rating) {
      return res.status(400).json({ success: false, message: 'menu_id dan rating wajib diisi' });
    }
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ success: false, message: 'Rating harus angka bulat 1-5' });
    }

    // Cek apakah user sudah pernah ulas menu ini (opsional, tapi untuk mencegah duplikasi)
    // Untuk sekarang, izinkan multiple ulasan

    const reviewId = await ReviewModel.create({ user_id, menu_id, rating, komentar });

    // If files were uploaded, persist records to review_photos
    try {
      const files = req.files || [];
      if (files.length > 0) {
        const insertRows = files.map(f => ({
          ulasan_id: reviewId,
          path: `/uploads/reviews/${f.filename}`,
          storage_provider: 'local',
          metadata: JSON.stringify({ originalname: f.originalname, mimetype: f.mimetype, size: f.size })
        }));

        const { data: photoData, error: photoErr } = await supabase.from('review_photos').insert(insertRows);
        if (photoErr) {
          console.error('Failed to insert review_photos', photoErr);
        }
      }
    } catch (e) {
      console.error('Error saving review photos:', e);
    }

    // Update rating dan jumlah ulasan pada menu
    await ReviewModel.updateMenuRating(menu_id);

    res.status(201).json({ success: true, message: 'Ulasan berhasil ditambahkan', data: { id: reviewId } });
  } catch (error) {
    console.error('Error tambah ulasan:', error);
    res.status(500).json({ success: false, message: 'Gagal menambah ulasan' });
  }
};

// Ambil ulasan berdasarkan menu
const getUlasanByMenu = async (req, res) => {
  try {
    const { menuId } = req.params;
    if (!menuId) {
      return res.status(400).json({ success: false, message: 'menuId wajib' });
    }

    const reviews = await ReviewModel.findByMenuId(menuId);
    const stats = await ReviewModel.getStats(menuId);

    res.json({ success: true, data: { reviews, stats } });
  } catch (error) {
    console.error('Error get ulasan:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil ulasan' });
  }
};

module.exports = { tambahUlasan, getUlasanByMenu };