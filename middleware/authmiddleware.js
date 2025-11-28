const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY; // Ambil dari .env

const verifyToken = (req, res, next) => {
    // Ambil token dari header Authorization (format: Bearer <token>)
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Akses Ditolak: Token tidak disediakan.' });
    }

    const token = authHeader.split(' ')[1]; // Ambil token saja (setelah 'Bearer ')

    try {
        if (!SECRET_KEY) {
            console.error('SECRET_KEY is not set in environment. JWT verification cannot proceed.');
            return res.status(500).json({ message: 'Server misconfiguration: secret key not set.' });
        }

        // Verifikasi token menggunakan secret key
        const decoded = jwt.verify(token, SECRET_KEY);

        // Simpan data user (id dan role) di objek request agar bisa diakses controller
        req.user = decoded;

        next(); // Lanjutkan ke controller
    } catch (error) {
        // Log error details to help debugging (temporary)
        console.error('JWT verify error:', error && error.name, error && error.message);
        // Provide specific status for expired tokens
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token kadaluarsa.' });
        }
        if (error && error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token tidak valid.' });
        }
        return res.status(403).json({ message: 'Token tidak valid atau kadaluarsa.' });
    }
};

const verifyAdmin = (req, res, next) => {
    // Pastikan user sudah diverifikasi tokennya terlebih dahulu
    if (req.user && req.user.role === 'admin') {
        next(); // Lanjutkan, user adalah Admin
    } else {
        return res.status(403).json({ message: 'Akses Ditolak: Hanya Admin yang diizinkan.' });
    }
};

const verifyPenjual = (req, res, next) => {
    // Pastikan user sudah diverifikasi tokennya terlebih dahulu
    if (req.user && (req.user.role === 'penjual' || req.user.role === 'admin')) {
        next(); // Lanjutkan, user adalah Penjual atau Admin
    } else {
        return res.status(403).json({ message: 'Akses Ditolak: Hanya Penjual yang diizinkan.' });
    }
};

module.exports = { verifyToken, verifyAdmin, verifyPenjual };