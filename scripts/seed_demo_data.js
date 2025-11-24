// scripts/seed_demo_data.js
// Inserts a demo restaurant and an approved menu_makanan row (Buddha Bowl).
const db = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Seeding demo restaurant...');
    const [res] = await db.execute(
      `INSERT INTO restorans (user_id, nama_restoran, deskripsi, alamat, latitude, longitude, no_telepon, status_verifikasi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Demo Rasa Sehat', 'Restoran demo untuk pengujian', 'Jl. Contoh No.1, Kota',  -6.200000, 106.816666, '081234567890', 'disetujui']
    );

    const restoranId = res.insertId || 1;
    console.log('Inserted restorans id=', restoranId);

    console.log('Ensuring demo category exists...');
    // Ensure there's at least one category to satisfy NOT NULL constraint
    const [catRows] = await db.execute("SELECT id FROM kategori_makanan WHERE nama_kategori = ? LIMIT 1", ['Umum']);
    let kategoriId;
    if (catRows && catRows.length) {
      kategoriId = catRows[0].id;
      console.log('Found existing kategori id=', kategoriId);
    } else {
      const [cres] = await db.execute(
        `INSERT INTO kategori_makanan (nama_kategori, deskripsi) VALUES (?, ?)`,
        ['Umum', 'Kategori umum untuk demo']
      );
      kategoriId = cres.insertId;
      console.log('Inserted kategori_makanan id=', kategoriId);
    }

    console.log('Seeding demo menu (Buddha Bowl)...');
    const slug = 'buddha-bowl';
    const [mres] = await db.execute(
      `INSERT INTO menu_makanan (restoran_id, nama_menu, deskripsi, harga, foto, kalori, protein, diet_claims, kategori_id, status_verifikasi, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [restoranId, 'Buddha Bowl', 'Bowl sehat berisi sayuran, biji-bijian, dan protein nabati.', 45000, 'https://via.placeholder.com/400x300.png?text=Buddha+Bowl', 520, 20, null, kategoriId, 'disetujui', slug]
    );

    console.log('Inserted menu_makanan id=', mres.insertId);

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message || err);
    process.exit(1);
  }
}

run();
