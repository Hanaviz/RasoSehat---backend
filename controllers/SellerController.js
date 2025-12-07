const supabase = require('../supabase/supabaseClient');
const RestaurantModel = require('../models/RestaurantModel');
const MenuModel = require('../models/MenuModel');

/**
 * GET /api/seller/my-store
 * Return seller's restaurant, menus, menuStats and analytics (dummy)
 */
const getMyStore = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Fetch restaurant for this seller using model
    const restos = await RestaurantModel.findByUserId(userId);
    const restaurant = restos && restos.length ? restos[0] : null;
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restoran penjual tidak ditemukan' });
    }

    // Use MenuModel helper which computes ratings and returns frontend-friendly shape
    const menuRows = await MenuModel.findByRestaurantId(restaurant.id);

    // menuStats
    const totalMenu = menuRows.length;
    const pending = menuRows.filter(m => m.status_verifikasi === 'pending').length;
    const approved = menuRows.filter(m => m.status_verifikasi === 'disetujui').length;
    const rejected = menuRows.filter(m => m.status_verifikasi === 'ditolak').length;

    const menuStats = { totalMenu, pending, approved, rejected };

    // analytics - dummy values for now
    const analytics = { visitors: 0, views: 0, ratings: 0 };

    return res.json({ success: true, restaurant, menus: menuRows, menuStats, analytics });
  } catch (err) {
    console.error('getMyStore error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data my-store' });
  }
};

module.exports = { getMyStore };
