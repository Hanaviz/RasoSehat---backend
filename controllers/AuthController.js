// RasoSehat-Backend/controllers/AuthController.js

const UserModel = require('../models/UserModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY; // Diambil dari .env

// Fungsi 1: Register User Baru
const register = async (req, res) => {
    const { name, email, password, birth_date, gender, phone, role } = req.body;
    try {
        // Cek apakah user sudah ada
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email sudah terdaftar.' });
        }

        // Hash password sebelum disimpan
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Buat user baru (default role: pembeli). Accept 'penjual' when explicitly requested.
        const extras = {};
        // sanitize role input: only allow 'penjual' to become penjual, otherwise default to 'pembeli'
        const normalizedRole = (typeof role === 'string' && role.toLowerCase() === 'penjual') ? 'penjual' : 'pembeli';
        if (birth_date) extras.birth_date = birth_date;
        if (gender) extras.gender = gender;
        if (phone) extras.phone = phone;
        await UserModel.create(name, email, password_hash, normalizedRole, extras);
        
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

// Ambil profil user lengkap dari token
const getProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] getProfile decoded token:', decoded);
        const user = await UserModel.findById(decoded.id);
        console.log('[DEBUG] getProfile db user:', user);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
        return res.status(200).json({ data: user });
    } catch (error) {
        console.error('getProfile error', error);
        return res.status(500).json({ message: 'Gagal mengambil profil.' });
    }
};

// Update profil user (name, birth_date, gender, phone)
const updateProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] updateProfile decoded token:', decoded);
        const allowed = ['name', 'birth_date', 'gender', 'phone', 'email'];
        const fields = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) fields[key] = req.body[key];
        }
        console.log('[DEBUG] updateProfile fields to update:', fields);
        if (!Object.keys(fields).length) return res.status(400).json({ message: 'Tidak ada data untuk diupdate.' });
        await UserModel.updateById(decoded.id, fields);
        const updated = await UserModel.findById(decoded.id);
        console.log('[DEBUG] updateProfile updated user:', updated);
        return res.status(200).json({ message: 'Profil diperbarui.', data: updated });
    } catch (error) {
        console.error('updateProfile error', error);
        return res.status(500).json({ message: 'Gagal mengupdate profil.' });
    }
};

// Upload avatar untuk user
const uploadAvatar = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] uploadAvatar decoded token:', decoded);
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan.' });
        // Build public path for avatar (serve via /uploads)
        const avatarPath = `/uploads/users/${req.file.filename}`;
        await UserModel.setAvatar(decoded.id, avatarPath);
        const updated = await UserModel.findById(decoded.id);
        console.log('[DEBUG] uploadAvatar updated user:', updated);
        return res.status(200).json({ message: 'Avatar terunggah.', avatar: avatarPath, data: updated });
    } catch (error) {
        console.error('uploadAvatar error', error);
        return res.status(500).json({ message: 'Gagal mengunggah avatar.' });
    }
};

module.exports = { register, login, verify, getProfile, updateProfile, uploadAvatar };