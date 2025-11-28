const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const { verifyToken } = require('../middleware/authmiddleware');
const adminMiddleware = require('../middleware/adminmiddleware');

// All routes require a valid token and admin role
router.get('/pending/restaurants', verifyToken, adminMiddleware, adminController.getPendingRestaurants);
router.get('/pending/menus', verifyToken, adminMiddleware, adminController.getPendingMenus);

router.put('/verify/restaurant/:id', verifyToken, adminMiddleware, adminController.verifyRestaurant);
router.put('/verify/menu/:id', verifyToken, adminMiddleware, adminController.verifyMenu);

module.exports = router;
