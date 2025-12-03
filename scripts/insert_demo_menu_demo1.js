const db = require('../config/db');

(async () => {
  try {
    const slug = 'demo-1';

    // Check if slug already exists
    const [existing] = await db.execute('SELECT id, slug, nama_menu FROM menu_makanan WHERE slug = ? LIMIT 1', [slug]);
    if (existing && existing.length) {
      console.log('Slug already exists:', existing[0]);
      process.exit(0);
    }

    // Insert a demo menu (associate to restoran_id 1 and kategori_id 6 if available)
    const restoranId = 1;
    const kategoriId = 6;
    const namaMenu = 'Demo Menu 1';
    const deskripsi = 'Menu demo untuk pengujian (demo-1).';
    const dietClaims = '[]';
    const harga = 35000.00;
    const foto = 'https://via.placeholder.com/400x300.png?text=Demo+Menu+1';

    const sql = `INSERT INTO menu_makanan (
      restoran_id, kategori_id, nama_menu, deskripsi, bahan_baku, metode_masak,
      diet_claims, kalori, protein, gula, lemak, serat, lemak_jenuh, harga, foto, status_verifikasi, created_at, updated_at, slug
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disetujui', NOW(), NOW(), ?)`;

    const params = [
      restoranId, kategoriId, namaMenu, deskripsi, null, null,
      dietClaims, 400, 12.0, 0.0, 5.0, 3.0, 1.0, harga, foto, slug
    ];

    const [result] = await db.execute(sql, params);
    console.log('Inserted demo menu id:', result.insertId);

    const [rows] = await db.execute('SELECT id, nama_menu, slug, status_verifikasi FROM menu_makanan WHERE id = ?', [result.insertId]);
    console.log('Inserted row:', rows[0]);
  } catch (err) {
    console.error('Error inserting demo menu:', err && err.stack ? err.stack : err);
  } finally {
    process.exit();
  }
})();
