const express = require('express');
const router = express.Router();
const menuController = require('../controllers/MenuController');
const { verifyToken, verifyPenjual } = require('../middleware/authmiddleware'); 
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
router.get('/search', menuController.search);

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
router.post('/', verifyToken, verifyPenjual, uploadMenu.single('foto'), menuController.createMenu);


module.exports = router;
