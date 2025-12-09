const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/ReviewController');
const authMiddleware = require('../middleware/authmiddleware');
const uploadReview = require('../middleware/uploadReviewMiddleware');

// POST /api/ulasan - tambah ulasan (butuh login)
// Accept up to 5 photos in field name `photos`
router.post('/', authMiddleware.verifyToken, uploadReview.array('photos', 5), reviewController.tambahUlasan);

// GET /api/ulasan/menu/:menuId - ambil ulasan menu
router.get('/menu/:menuId', reviewController.getUlasanByMenu);

module.exports = router;