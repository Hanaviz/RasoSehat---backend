// middleware/adminmiddleware.js
// Verifies that req.user exists and has role 'admin'
module.exports = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    return res.status(403).json({ message: 'Akses Ditolak: Hanya Admin yang diizinkan.' });
};
