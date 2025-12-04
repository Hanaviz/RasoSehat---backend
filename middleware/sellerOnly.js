module.exports = function sellerOnly(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'penjual') {
      return res.status(403).json({ success: false, message: 'Akses hanya untuk penjual' });
    }
    return next();
  } catch (err) {
    console.error('sellerOnly middleware error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};