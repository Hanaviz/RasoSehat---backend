const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');
const adminUserController = require('../controllers/AdminUserController');
const { verifyToken } = require('../middleware/authmiddleware');
const adminMiddleware = require('../middleware/adminmiddleware');

// All routes require a valid token and admin role

// ===== RESTAURANT & MENU VERIFICATION =====
router.get('/pending/restaurants', verifyToken, adminMiddleware, adminController.getPendingRestaurants);
router.get('/pending/menus', verifyToken, adminMiddleware, adminController.getPendingMenus);
router.get('/restaurant/:id', verifyToken, adminMiddleware, adminController.getRestaurantById);
// New: Active and history endpoints for management views
router.get('/restaurants/active', verifyToken, adminMiddleware, adminController.getActiveRestaurants);
router.get('/restaurants/history', verifyToken, adminMiddleware, adminController.getRestaurantVerificationHistory);
// KPI summary for dashboard cards
router.get('/kpi/summary', verifyToken, adminMiddleware, adminController.getKpiSummary);
// Debugging: return sample of verifikasi table (admin only)
router.get('/verifikasi/debug', verifyToken, adminMiddleware, adminController.getVerifikasiDebug);
// DEV-ONLY public sample route (no auth) when NODE_ENV=development
if (process.env.NODE_ENV === 'development') {
	router.get('/verifikasi/debug-public', adminController.getVerifikasiDebugPublic);
}
router.put('/verify/restaurant/:id', verifyToken, adminMiddleware, adminController.verifyRestaurant);
// New PATCH endpoint for admin verification (required flow)
router.patch('/restaurants/:id/verify', verifyToken, adminMiddleware, adminController.patchVerifyRestaurant);
router.put('/verify/menu/:id', verifyToken, adminMiddleware, adminController.verifyMenu);
router.get('/menus/active', verifyToken, adminMiddleware, adminController.getActiveMenus);
router.get('/menus/history', verifyToken, adminMiddleware, adminController.getMenuVerificationHistory);

// ===== USER MANAGEMENT =====
router.get('/users', verifyToken, adminMiddleware, adminUserController.getAllUsers);
router.get('/users/:id', verifyToken, adminMiddleware, adminUserController.getUserById);
router.patch('/users/:id/role', verifyToken, adminMiddleware, adminUserController.updateUserRole);
router.delete('/users/:id', verifyToken, adminMiddleware, adminUserController.deleteUser);

module.exports = router;
