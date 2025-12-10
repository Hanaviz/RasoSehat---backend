const express = require('express');
const router = express.Router();
const menuController = require('../controllers/MenuController');
const { verifyToken } = require('../middleware/authmiddleware'); 
const validateMenu = require('../middleware/validateMenu');
const uploadMenu = require('../middleware/uploadMenuMiddleware');
// Note: Middleware role seperti verifyPenjual bisa ditambahkan nanti

// =================================================================
// RUTE PUBLIK
// =================================================================

/**
 * @route GET /api/menus/featured
 * @description Mengambil daftar menu unggulan
 * @access Public
 */
router.get('/featured', menuController.getFeatured ? menuController.getFeatured : async (req,res)=>{ res.status(404).json({success:false, message:'Not implemented'}); });

/**
 * @route GET /api/menus/search
 * @description Pencarian dan filtering menu
 * @access Public
 */
// NOTE: legacy menu-specific search endpoint removed. Unified search is available
// under `/api/search` (see routes/searchRoutes.js). This keeps a single
// canonical search entrypoint for menus, restaurants and categories.

/**
 * @route GET /api/menus/by-category/:key
 * @description Ambil menu berdasarkan diet claim key (mis. low_calorie, high_fiber)
 * @access Public
 */
router.get('/by-category/:key', menuController.getByCategory);

/**
 * @route GET /api/menus/slug/:slug
 * @description Ambil detail menu berdasarkan slug (friendly URL)
 * @access Public
 */
router.get('/slug/:slug', menuController.getBySlug);

/**
 * @route GET /api/menus/:id
 * @description Detail menu berdasarkan ID
 * @access Public
 */
router.get('/:id', menuController.getById);

/**
 * @route GET /api/menus
 * @description List semua menu (publik)
 * @access Public
 */
router.get('/', menuController.list);



// =================================================================
// RUTE TERPROTEKSI (Perlu token)
// =================================================================

/**
 * @route POST /api/menus
 * @description Menambah menu baru (khusus Penjual/Admin)
 * @access Protected
 */
// Protected: create menu (upload foto)
router.post('/', verifyToken, uploadMenu.single('foto'), validateMenu, menuController.createMenu);

// Protected: update menu (owner or admin) - syncs pivots
router.patch('/:id', verifyToken, uploadMenu.single('foto'), validateMenu, menuController.updateMenu);


module.exports = router;
