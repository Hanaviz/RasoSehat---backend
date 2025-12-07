// RasoSehat-Backend/routes/categoryRoutes.js

const express = require('express');
const router = express.Router();
// Menggunakan jalur relatif ke config/db dari folder routes/
const supabase = require('../supabase/supabaseClient'); 

// Endpoint: GET /api/categories
router.get('/', async (req, res) => {
    try {
        // Query untuk mengambil ID dan nama kategori
        const { data, error } = await supabase.from('kategori_makanan').select('id,nama_kategori,deskripsi').lte('id', 5);
        if (error) {
            console.error('Error fetching categories:', error);
            return res.status(500).json({ message: 'Internal Server Error', detail: error.message });
        }
        // Mengirimkan data kategori sebagai JSON
        res.status(200).json(data || []);
    } catch (error) {
        console.error('Error fetching categories:', error);
        // Jika ada error database, kirimkan status 500
        res.status(500).json({ message: 'Internal Server Error', detail: error.message });
    }
});

module.exports = router;