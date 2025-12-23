// RasoSehat-Backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const uploadAvatar = require('../middleware/uploadAvatarMiddleware');

// Dev: log entry to this router so we can see when /api/auth/* is hit
if (process.env.NODE_ENV !== 'production') {
	router.use((req, res, next) => {
		try {
			console.debug('[authRoutes] incoming', req.method, req.originalUrl, 'bodyKeys:', Object.keys(req.body || {}));
		} catch (e) {}
		next();
	});
}

router.post('/register', authController.register); // Untuk frontend SignUp.jsx
router.post('/login', authController.login);   // Untuk frontend Signin.jsx
router.get('/user', authController.verify);    // Verifikasi token dan ambil data user
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.patch('/change-password', authController.changePassword);
router.post('/avatar', uploadAvatar.single('avatar'), authController.uploadAvatar);

module.exports = router;