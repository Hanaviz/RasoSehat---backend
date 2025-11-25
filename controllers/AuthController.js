// RasoSehat-Backend/controllers/AuthController.js

const UserModel = require('../models/UserModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY; // Diambil dari .env

// Fungsi 1: Register User Baru
const register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // Cek apakah user sudah ada
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email sudah terdaftar.' });
        }

        // Hash password sebelum disimpan
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Buat user baru (default role: pembeli)
        await UserModel.create(name, email, password_hash, 'pembeli');
        
        res.status(201).json({ message: 'Registrasi berhasil! Silakan login.' });

    } catch (error) {
        console.error('Error saat register:', error);
        res.status(500).json({ message: 'Gagal melakukan registrasi.' });
    }
};

// Fungsi 2: Login dan Mengembalikan Token JWT
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Kredensial tidak valid.' });
        }

        // Bandingkan password yang diinput dengan hash di DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Kredensial tidak valid.' });
        }

        // Buat JWT Token
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name }, 
            SECRET_KEY, 
            { expiresIn: '2h' } // Token berlaku 2 jam
        );
        
        // Kirim token dan info user ke frontend
        res.status(200).json({
            message: 'Login berhasil!',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ message: 'Login gagal.' });
    }
};

// Fungsi 3: Verifikasi token dan kembalikan data user
const verify = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) {
            return res.status(401).json({ message: 'Token tidak ditemukan.' });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        // Kembalikan payload minimal sebagai user
        return res.status(200).json({ user: { id: decoded.id, name: decoded.name, role: decoded.role } });

    } catch (error) {
        console.error('Error saat memverifikasi token:', error);
        if (error && (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError')) {
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        return res.status(500).json({ message: 'Gagal memverifikasi token.' });
    }
};

module.exports = { register, login, verify };