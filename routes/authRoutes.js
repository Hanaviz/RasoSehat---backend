// RasoSehat-Backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');

router.post('/register', authController.register); // Untuk frontend SignUp.jsx
router.post('/login', authController.login);   // Untuk frontend Signin.jsx
router.get('/user', authController.verify);    // Verifikasi token dan ambil data user

module.exports = router;