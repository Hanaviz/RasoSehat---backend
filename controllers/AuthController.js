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
const uploadAvatar = async (req, res) => {
    let localPath = null;
    
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

        localPath = req.file.path;
        const filename = req.file.filename;
        
        // Build relative URL path (akan di-serve oleh express.static)
        const avatarUrlToSave = `/uploads/users/${filename}`;
        
        console.log('[DEBUG] Avatar file saved:', {
            localPath,
            filename,
            avatarUrl: avatarUrlToSave
        });

        let uploadMethod = 'local';
        let supabaseUrl = null;

        // Try Supabase upload as backup (optional)
        try {
            const bucket = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';
            const storagePath = `users/${decoded.id}/${filename}`;
            const buffer = fs.readFileSync(localPath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(storagePath, buffer, {
                    contentType: req.file.mimetype,
                    upsert: true,
                });

            if (!uploadError) {
                const { data: publicData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(storagePath);
                
                if (publicData && publicData.publicUrl) {
                    supabaseUrl = publicData.publicUrl;
                    uploadMethod = 'supabase';
                    console.log('[SUCCESS] Supabase backup upload successful:', supabaseUrl);
                }
            } else {
                console.warn('[INFO] Supabase upload skipped/failed, using local only:', uploadError.message);
            }
        } catch (supabaseError) {
            console.warn('[INFO] Supabase upload error (using local only):', supabaseError.message);
        }

        // Save to database (always use local path for consistency)
        await UserModel.setAvatar(decoded.id, avatarUrlToSave);
        console.log('[DEBUG] Avatar URL saved to database:', avatarUrlToSave);
        
        // Get updated user data
        const updated = await UserModel.findById(decoded.id);
        const { password: _p, ...sanitized } = updated || {};
        
        // Return response dengan URL yang konsisten
        return res.status(200).json({ 
            success: true,
            message: 'Avatar berhasil diunggah.',
            avatar: avatarUrlToSave,
            avatar_url: avatarUrlToSave,
            supabase_url: supabaseUrl, // Optional backup URL
            upload_method: uploadMethod,
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

// Change password for authenticated user
const changePassword = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^(Bearer )/i, '');
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        const forgotPassword = async (req, res) => {
            try {
                const { email } = req.body || {};
                if (!email) return res.status(400).json({ success: false, message: 'Email diperlukan.' });

                // Generate a secure random token
                const crypto = require('crypto');
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour

                // insert into password_resets table
                try {
                    await supabase.from('password_resets').insert({ email, token, expires_at: expiresAt.toISOString() });
                } catch (dbErr) {
                    console.warn('Failed to insert password_resets row:', dbErr?.message || dbErr);
                }

                // Send email with reset link (do not reveal whether email exists)
                const { sendMail, FRONTEND_URL, EMAIL_FROM } = require('../utils/emailService');
                const resetLink = `${String(FRONTEND_URL).replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

                const subject = 'Permintaan Reset Kata Sandi — RasoSehat';
                const html = `
                    <p>Hai,</p>
                    <p>Kami menerima permintaan untuk mereset kata sandi akun ini. Klik tombol di bawah untuk mengganti kata sandi (tautan berlaku 1 jam).</p>
                    <p><a href="${resetLink}" style="display:inline-block;padding:10px 14px;background:#10b981;color:#fff;border-radius:6px;text-decoration:none">Reset Kata Sandi</a></p>
                    <p>Jika Anda tidak meminta reset, abaikan email ini.</p>
                `;

                try {
                    await sendMail({ from: EMAIL_FROM, to: email, subject, html, text: `Reset password: ${resetLink}` });
                } catch (mailErr) {
                    console.warn('sendMail failed for forgotPassword:', mailErr?.message || mailErr);
                }

                // Always return success to avoid leaking whether the email exists
                return res.status(200).json({ success: true, message: 'Jika email terdaftar, instruksi reset telah dikirim.' });
            } catch (error) {
                console.error('forgotPassword error', error);
                return res.status(500).json({ success: false, message: 'Gagal memproses permintaan reset.' });
            }
        };

        // Reset password: verify token and update password
        const resetPassword = async (req, res) => {
            try {
                const { token, email, newPassword, confirmPassword } = req.body || {};
                if (!token || !email || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: 'Semua field diperlukan.' });
                if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Konfirmasi kata sandi tidak cocok.' });
                if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter.' });

                // Find valid token
                const { data: rows, error } = await supabase.from('password_resets').select('*').eq('token', token).eq('email', email).limit(1).order('created_at', { ascending: false });
                if (error) {
                    console.error('supabase select password_resets error', error);
                    return res.status(500).json({ success: false, message: 'Kesalahan server.' });
                }

                const row = (rows && rows[0]) || null;
                if (!row) return res.status(400).json({ success: false, message: 'Token tidak valid atau sudah digunakan.' });
                if (row.used) return res.status(400).json({ success: false, message: 'Token sudah digunakan.' });
                if (new Date(row.expires_at) < new Date()) return res.status(400).json({ success: false, message: 'Token telah kadaluarsa.' });

                // Update user password
                const salt = await bcrypt.genSalt(10);
                const hashed = await bcrypt.hash(newPassword, salt);
                // Find user by email
                const user = await UserModel.findByEmail(email);
                if (!user) {
                    // Still mark token used to avoid reuse
                    try { await supabase.from('password_resets').update({ used: true, used_at: new Date().toISOString() }).eq('id', row.id); } catch (e) {}
                    return res.status(400).json({ success: false, message: 'Akun tidak ditemukan.' });
                }

                await UserModel.updatePassword(user.id, hashed);

                // Mark token used
                try {
                    await supabase.from('password_resets').update({ used: true, used_at: new Date().toISOString() }).eq('id', row.id);
                } catch (e) {
                    console.warn('Failed to mark password_resets used', e?.message || e);
                }

                return res.status(200).json({ success: true, message: 'Kata sandi berhasil diubah. Silakan login dengan kata sandi baru.' });
            } catch (error) {
                console.error('resetPassword error', error);
                return res.status(500).json({ success: false, message: 'Gagal mereset kata sandi.' });
            }
        };
        const userId = decoded && decoded.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User tidak terautentikasi.' });

        const { currentPassword, newPassword, confirmPassword } = req.body || {};
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Konfirmasi kata sandi tidak cocok.' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter.' });
        }

        // Get raw user row (includes password hash)
        const userRaw = await UserModel.findRawById(userId);
        if (!userRaw) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

        const isMatch = await bcrypt.compare(currentPassword, userRaw.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Kata sandi lama salah.' });

        // Prevent setting same as old
        const sameAsOld = await bcrypt.compare(newPassword, userRaw.password);
        if (sameAsOld) return res.status(400).json({ success: false, message: 'Kata sandi baru tidak boleh sama dengan yang lama.' });

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);

        await UserModel.updatePassword(userId, hashed);

        return res.status(200).json({ success: true, message: 'Kata sandi berhasil diubah.' });
    } catch (error) {
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Token tidak valid.' });
        }
        console.error('changePassword error', error);
        return res.status(500).json({ success: false, message: 'Gagal mengubah kata sandi.' });
    }
};

module.exports = { 
    register, 
    login, 
    verify, 
    getProfile, 
    updateProfile, 
    uploadAvatar,
    changePassword
    forgotPassword,
    resetPassword
};