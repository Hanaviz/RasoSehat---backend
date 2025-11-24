const express = require('express');
const router = express.Router();
const menuController = require('../controllers/MenuController');
const { verifyToken } = require('../middleware/authmiddleware'); 
// Note: Middleware role seperti verifyPenjual bisa ditambahkan nanti

// =================================================================
// RUTE PUBLIK
// =================================================================

/**
 * @route GET /api/menus/featured
 * @description Mengambil daftar menu unggulan
 * @access Public
 */
router.get('/featured', menuController.getFeatured);

/**
 * @route GET /api/menus/search
 * @description Pencarian dan filtering menu
 * @access Public
 */
router.get('/search', menuController.searchMenus);

/**
 * @route GET /api/menus/:id
 * @description Detail menu berdasarkan ID
 * @access Public
 */
router.get('/:id', menuController.getMenuDetail);

/**
 * @route GET /api/menus/slug/:slug
 * @description Ambil detail menu berdasarkan slug (friendly URL)
 * @access Public
 */
router.get('/slug/:slug', menuController.getMenuBySlug);



// =================================================================
// RUTE TERPROTEKSI (Perlu token)
// =================================================================

/**
 * @route POST /api/menus
 * @description Menambah menu baru (khusus Penjual/Admin)
 * @access Protected
 */
// Contoh:
// router.post('/', verifyToken, verifyPenjual, menuController.addMenu);


module.exports = router;
