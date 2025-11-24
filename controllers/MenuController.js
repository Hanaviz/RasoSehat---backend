const MenuModel = require('../models/MenuModel');

// 1. Controller untuk Home Page (Menu Unggulan)
const getFeatured = async (req, res) => {
    try {
        const menus = await MenuModel.getFeaturedMenus(8); // Ambil 8 menu teratas
        res.status(200).json(menus);
    } catch (error) {
        console.error('Error fetching featured menus:', error);
        res.status(500).json({ message: 'Gagal memuat menu unggulan.' });
    }
};

// 2. Controller untuk Pencarian dan Filter (Search Results Page)
const searchMenus = async (req, res) => {
    const { q: query, category_id: categoryId, rating } = req.query; // Menerima parameter dari URL
    
    try {
        const menus = await MenuModel.searchAndFilter(query, categoryId, rating);

        // Map data untuk parse JSON string di kolom diet_claims
        const safeMenus = menus.map(menu => ({
            ...menu,
            // Mengubah string JSON diet_claims menjadi array JavaScript
            diet_claims: JSON.parse(menu.diet_claims || '[]'),
        }));

        res.status(200).json(safeMenus);
    } catch (error) {
        console.error('Error saat pencarian menu:', error);
        res.status(500).json({ message: 'Pencarian gagal.' });
    }
};

// 3. Controller untuk Detail Menu
const getMenuDetail = async (req, res) => {
    const menuId = req.params.id; // Asumsi frontend akan mengirim ID
    try {
        const menu = await MenuModel.getMenuDetail(menuId);
        
        if (!menu) {
            return res.status(404).json({ message: 'Menu tidak ditemukan atau belum diverifikasi.' });
        }
        
        // Map data untuk parse JSON
        menu.diet_claims = JSON.parse(menu.diet_claims || '[]');
        
        res.status(200).json(menu);
    } catch (error) {
        console.error('Error saat mengambil detail menu:', error);
        res.status(500).json({ message: 'Gagal memuat detail menu.' });
    }
};

// 4. Controller untuk mendapatkan menu berdasarkan slug (frontend menggunakan slug)
const getMenuBySlug = async (req, res) => {
    const slug = req.params.slug;
    try {
        const menu = await MenuModel.getMenuBySlug(slug);
        if (!menu) return res.status(404).json({ message: 'Menu tidak ditemukan' });
        // Map data jika perlu
        menu.diet_claims = JSON.parse(menu.diet_claims || '[]');
        res.status(200).json(menu);
    } catch (error) {
        console.error('Error saat mengambil menu by slug:', error);
        res.status(500).json({ message: 'Gagal memuat detail menu.' });
    }
};

module.exports = { getFeatured, searchMenus, getMenuDetail, getMenuBySlug };