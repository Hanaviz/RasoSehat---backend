const ReviewModel = require('../models/ReviewModel');
const supabase = require('../supabase/supabaseClient');
const path = require('path');

// Tambah ulasan
const tambahUlasan = async (req, res) => {
  try {
    let { menu_id, rating, komentar } = req.body;
    const user_id = req.user.id; // dari authmiddleware

    // FormData posts fields as strings — coerce to numbers for validation
    const menuIdNum = Number(menu_id);
    const ratingNum = Number(rating);

    // Validasi
    if (!menu_id || Number.isNaN(menuIdNum) || Number.isNaN(ratingNum)) {
      return res.status(400).json({ success: false, message: 'menu_id dan rating wajib diisi' });
    }
    if (ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return res.status(400).json({ success: false, message: 'Rating harus angka bulat 1-5' });
    }

    // Cek apakah user sudah pernah ulas menu ini (opsional, tapi untuk mencegah duplikasi)
    // Untuk sekarang, izinkan multiple ulasan

    const reviewId = await ReviewModel.create({ user_id, menu_id: menuIdNum, rating: ratingNum, komentar });

    // If files were uploaded, upload to Supabase and persist records to review_photos
    try {
      const files = req.files || [];
      if (files.length > 0) {
        const { uploadBufferToSupabase } = require('../utils/imageHelper');
        const insertRows = [];
        for (const f of files) {
          try {
            const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}-${f.originalname.replace(/[^a-z0-9.\-_]/gi,'')}`;
            const dest = `reviews/${reviewId}/${filename}`;
            const publicUrl = await uploadBufferToSupabase(f.buffer, dest, f.mimetype);
            insertRows.push({
              ulasan_id: reviewId,
              path: publicUrl || null,
              storage_provider: publicUrl ? 'supabase' : 'local',
              metadata: JSON.stringify({ originalname: f.originalname, mimetype: f.mimetype, size: f.size })
            });
          } catch (e) {
            console.warn('Failed to upload review photo to supabase', e.message || e);
          }
        }

        if (insertRows.length) {
          const { data: photoData, error: photoErr } = await supabase.from('review_photos').insert(insertRows);
          if (photoErr) console.error('Failed to insert review_photos', photoErr);
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