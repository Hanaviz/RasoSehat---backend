// RasoSehat-Backend/routes/categoryRoutes.js

const express = require('express');
const router = express.Router();
// Menggunakan jalur relatif ke config/db dari folder routes/
const db = require('../config/db.js'); 

// Endpoint: GET /api/categories
router.get('/', async (req, res) => {
    try {
        // Query untuk mengambil ID dan nama kategori
        const query = 'SELECT id, nama_kategori, deskripsi FROM kategori_makanan WHERE id <= 5'; 
        const [categories] = await db.execute(query);
        
        // Mengirimkan data kategori sebagai JSON
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        // Jika ada error database, kirimkan status 500
        res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
});

module.exports = router;