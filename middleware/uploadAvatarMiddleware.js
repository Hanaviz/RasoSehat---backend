// RasoSehat-Backend/middleware/uploadAvatarMiddleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'users');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('[uploadAvatarMiddleware] Created directory:', uploadsDir);
}

// Use memory storage: controllers will upload to Supabase and avoid local files
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Hanya file JPG, JPEG, dan PNG yang diperbolehkan'), false);
    }
};

// Create multer instance
const uploadAvatar = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: fileFilter
});

module.exports = uploadAvatar;