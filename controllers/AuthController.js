// RasoSehat-Backend/controllers/AuthController.js - COMPLETE FIXED VERSION

const UserModel = require('../models/UserModel');
const supabase = require('../supabase/supabaseClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;
const fs = require('fs');
const path = require('path');

// Fungsi 1: Register User Baru
const register = async (req, res) => {
    const { name, email, password, birth_date, gender, phone, role } = req.body;
    try {
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'Email sudah terdaftar.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const extras = {};
        const normalizedRole = (typeof role === 'string' && role.toLowerCase() === 'penjual') ? 'penjual' : 'pembeli';
        if (birth_date) extras.birth_date = birth_date;
        if (gender) extras.gender = gender;
        if (phone) extras.phone = phone;
        
        const newId = await UserModel.create(name, email, password_hash, normalizedRole, extras);
        return res.status(201).json({ 
            success: true,
            message: 'Registrasi berhasil! Silakan login.', 
            id: newId 
        });

    } catch (error) {
        console.error('Error saat register:', error);
        res.status(500).json({ 
            success: false,
            message: 'Gagal melakukan registrasi.' 
        });
    }
};

// Fungsi 2: Login dan Mengembalikan Token JWT
const login = async (req, res) => {
    console.log('[DEBUG] POST /auth/login body:', req.body);
    const { email, password } = req.body || {};
    
    try {
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Kredensial tidak valid.' 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Kredensial tidak valid.' 
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name }, 
            SECRET_KEY, 
            { expiresIn: '2h' }
        );
        
        return res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            token,
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: user.role,
                avatar: user.avatar || null
            }
        });

    } catch (error) {
        console.error('Error saat login:', error && error.stack ? error.stack : error);
        res.status(500).json({ 
            success: false,
            message: 'Login gagal.' 
        });
    }
};

// Fungsi 3: Verifikasi token dan kembalikan data user
const verify = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak ditemukan.' 
            });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        return res.status(200).json({ 
            success: true,
            user: { 
                id: decoded.id, 
                name: decoded.name, 
                role: decoded.role 
            } 
        });

    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            console.warn('Token verification failed: token expired');
            return res.status(401).json({ 
                success: false,
                message: 'Token kadaluarsa.' 
            });
        }
        if (error && error.name === 'JsonWebTokenError') {
            console.warn('Token verification failed: invalid token');
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak valid.' 
            });
        }
        console.error('Error saat memverifikasi token:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Gagal memverifikasi token.' 
        });
    }
};

// Ambil profil user lengkap dari token
const getProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak ditemukan.' 
            });
        }
        
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] getProfile decoded token:', decoded);
        
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User tidak ditemukan.' 
            });
        }
        
        // Sanitize: do not include password
        const { password, ...sanitized } = user;
        
        return res.status(200).json({ 
            success: true,
            data: sanitized 
        });
        
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token kadaluarsa.' 
            });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak valid.' 
            });
        }
        console.error('getProfile error', error);
        return res.status(500).json({ 
            success: false,
            message: 'Gagal mengambil profil.' 
        });
    }
};

// Update profil user
const updateProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak ditemukan.' 
            });
        }
        
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] updateProfile decoded token:', decoded);
        
        const allowed = ['name', 'birth_date', 'gender', 'phone', 'email'];
        const fields = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) fields[key] = req.body[key];
        }
        
        console.log('[DEBUG] updateProfile fields to update:', fields);
        
        if (!Object.keys(fields).length) {
            return res.status(400).json({ 
                success: false,
                message: 'Tidak ada data untuk diupdate.' 
            });
        }
        
        await UserModel.updateById(decoded.id, fields);
        const updated = await UserModel.findById(decoded.id);
        const { password, ...sanitized } = updated || {};
        
        return res.status(200).json({ 
            success: true,
            message: 'Profil diperbarui.', 
            data: sanitized 
        });
        
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token kadaluarsa.' 
            });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak valid.' 
            });
        }
        console.error('updateProfile error', error);
        return res.status(500).json({ 
            success: false,
            message: 'Gagal mengupdate profil.' 
        });
    }
};

// Upload avatar untuk user - COMPLETE FIXED VERSION
const { uploadBufferToSupabase } = require('../utils/imageHelper');

const uploadAvatar = async (req, res) => {
    
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak ditemukan.' 
            });
        }
        
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('[DEBUG] uploadAvatar decoded token:', decoded);
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'File tidak ditemukan.' 
            });
        }
        const file = req.file;
        let publicUrl = null;
        try {
            const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}-${file.originalname.replace(/[^a-z0-9.\-_]/gi,'')}`;
            const dest = `users/${decoded.id}/${filename}`;
            const bucket = process.env.SUPABASE_AVATAR_BUCKET || process.env.SUPABASE_PUBLIC_IMAGES_BUCKET || 'public-images';
            // uploadBufferToSupabase uses default BUCKET; if you want specific bucket, use supabase client directly
            publicUrl = await uploadBufferToSupabase(file.buffer, dest, file.mimetype);
        } catch (e) {
            console.warn('Avatar upload to Supabase failed', e.message || e);
        }

        const avatarUrlToSave = publicUrl || null;
        await UserModel.setAvatar(decoded.id, avatarUrlToSave);
        const updated = await UserModel.findById(decoded.id);
        const { password: _p, ...sanitized } = updated || {};

        return res.status(200).json({
            success: true,
            message: 'Avatar berhasil diunggah.',
            avatar: avatarUrlToSave,
            avatar_url: avatarUrlToSave,
            upload_method: publicUrl ? 'supabase' : 'none',
            data: sanitized
        });

    } catch (error) {
        // Clean up local file on error
        if (localPath && fs.existsSync(localPath)) {
            try { 
                fs.unlinkSync(localPath); 
                console.log('[CLEANUP] Removed local file after error');
            } catch (e) { 
                console.warn('[CLEANUP] Failed to remove local file:', e);
            }
        }
        
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token kadaluarsa.' 
            });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token tidak valid.' 
            });
        }
        
        console.error('uploadAvatar error', error);
        return res.status(500).json({ 
            success: false,
            message: 'Gagal mengunggah avatar.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = { 
    register, 
    login, 
    verify, 
    getProfile, 
    updateProfile, 
    uploadAvatar 
};