// RasoSehat-Backend/controllers/AuthController.js

const UserModel = require('../models/UserModel');
const supabase = require('../supabase/supabaseClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY; // Diambil dari .env
const fs = require('fs');
const path = require('path');

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
        const newId = await UserModel.create(name, email, password_hash, normalizedRole, extras);
        return res.status(201).json({ message: 'Registrasi berhasil! Silakan login.', id: newId });

    } catch (error) {
        console.error('Error saat register:', error);
        res.status(500).json({ message: 'Gagal melakukan registrasi.' });
    }
};

// Fungsi 2: Login dan Mengembalikan Token JWT
const login = async (req, res) => {
    // Debug: log incoming body to help diagnose empty/invalid payloads
    console.log('[DEBUG] POST /auth/login body:', req.body);
    const { email, password } = req.body || {};
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
        return res.status(200).json({
            message: 'Login berhasil!',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Error saat login:', error && error.stack ? error.stack : error);
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
        // Don't print full stack for expected JWT errors
        if (error && error.name === 'TokenExpiredError') {
            console.warn('Token verification failed: token expired');
            return res.status(401).json({ message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            console.warn('Token verification failed: invalid token');
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        console.error('Error saat memverifikasi token (unexpected):', error && error.stack ? error.stack : error);
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
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
        // sanitize: do not include password
        const { password, ...sanitized } = user;
        return res.status(200).json({ data: sanitized });
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        console.error('getProfile error', error && error.stack ? error.stack : error);
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
        const { password, ...sanitized } = updated || {};
        return res.status(200).json({ message: 'Profil diperbarui.', data: sanitized });
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        console.error('updateProfile error', error && error.stack ? error.stack : error);
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

                // Upload to Supabase Storage bucket 'avatars' under users/<id>/filename
                const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
                const localPath = req.file.path;
                const filename = `${Date.now()}-${req.file.filename}`;
                const storagePath = `users/${decoded.id}/${filename}`;

                // Read file buffer
                const buffer = fs.readFileSync(localPath);

                const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
                    contentType: req.file.mimetype,
                    upsert: false,
                });

                // Remove local file (we'll keep a local copy until we decide final URL)
                try { fs.unlinkSync(localPath); } catch (e) { /* ignore */ }

                // Default fallback to local uploads path
                let avatarUrlToSave = `/uploads/users/${req.file.filename}`;

                if (uploadError) {
                    // If Supabase upload fails, log full error but continue using local file path
                    console.error('Supabase storage upload error (falling back to local file):', uploadError);
                } else {
                    // Try to resolve public URL from Supabase storage
                    try {
                        const { data: publicData, error: publicErr } = supabase.storage.from(bucket).getPublicUrl(storagePath);
                        if (publicErr) {
                            console.error('Supabase getPublicUrl error', publicErr);
                        } else {
                            const publicUrl = publicData?.publicUrl || null;
                            if (publicUrl) avatarUrlToSave = publicUrl;
                        }
                    } catch (e) {
                        console.error('Error getting public url for avatar', e);
                    }
                }
                await UserModel.setAvatar(decoded.id, avatarUrlToSave);
                const updated = await UserModel.findById(decoded.id);
                const { password: _p, ...sanitized } = updated || {};
                return res.status(200).json({ message: 'Avatar terunggah.', avatar: avatarUrlToSave, data: sanitized });
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        console.error('uploadAvatar error', error && error.stack ? error.stack : error);
        return res.status(500).json({ message: 'Gagal mengunggah avatar.' });
    }
};

module.exports = { register, login, verify, getProfile, updateProfile, uploadAvatar };