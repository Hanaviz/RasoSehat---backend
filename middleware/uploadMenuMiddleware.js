const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'menu');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Use memory storage so controllers can upload directly to Supabase
const storage = multer.memoryStorage();

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter (req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipe file tidak diizinkan. Hanya JPG/PNG/WEBP.'), false);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } });

module.exports = upload;
