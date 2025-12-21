const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use memory storage to allow controllers to upload directly to Supabase
const storage = multer.memoryStorage();

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp'
];

function fileFilter (req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan. Hanya JPG/PNG/WEBP.'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

module.exports = upload;
