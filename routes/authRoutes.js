// RasoSehat-Backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const uploadAvatar = require('../middleware/uploadAvatarMiddleware');

router.post('/register', authController.register); // Untuk frontend SignUp.jsx
router.post('/login', authController.login);   // Untuk frontend Signin.jsx
router.get('/user', authController.verify);    // Verifikasi token dan ambil data user
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/avatar', uploadAvatar.single('avatar'), authController.uploadAvatar);

module.exports = router;