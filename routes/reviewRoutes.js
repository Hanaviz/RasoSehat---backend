const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/ReviewController');
const authMiddleware = require('../middleware/authmiddleware');

// POST /api/ulasan - tambah ulasan (butuh login)
router.post('/', authMiddleware.verifyToken, reviewController.tambahUlasan);

// GET /api/ulasan/menu/:menuId - ambil ulasan menu
router.get('/menu/:menuId', reviewController.getUlasanByMenu);

module.exports = router;