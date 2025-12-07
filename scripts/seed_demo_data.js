// scripts/seed_demo_data.js
// Inserts a demo restaurant and an approved menu_makanan row (Buddha Bowl).
const supabase = require('../supabase/supabaseClient');
require('dotenv').config();

async function run() {
  try {
    console.log('Seeding demo restaurant...');
    const { data: insertRestoRes, error: restoErr } = await supabase.from('restorans').insert({ user_id: 1, nama_restoran: 'Demo Rasa Sehat', deskripsi: 'Restoran demo untuk pengujian', alamat: 'Jl. Contoh No.1, Kota', latitude: -6.2, longitude: 106.816666, no_telepon: '081234567890', status_verifikasi: 'disetujui', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select('id');
    if (restoErr) throw restoErr;
    const restoranId = insertRestoRes && insertRestoRes[0] ? insertRestoRes[0].id : 1;
    console.log('Inserted restorans id=', restoranId);

    console.log('Ensuring demo category exists...');
    // Ensure there's at least one category to satisfy NOT NULL constraint
    const { data: catRes } = await supabase.from('kategori_makanan').select('id').eq('nama_kategori', 'Umum').limit(1);
    let kategoriId;
    if (catRes && catRes.length) {
      kategoriId = catRes[0].id;
      console.log('Found existing kategori id=', kategoriId);
    } else {
      const { data: cres, error: cresErr } = await supabase.from('kategori_makanan').insert({ nama_kategori: 'Umum', deskripsi: 'Kategori umum untuk demo' }).select('id');
      if (cresErr) throw cresErr;
      kategoriId = cres && cres[0] ? cres[0].id : null;
      console.log('Inserted kategori_makanan id=', kategoriId);
    }

    console.log('Seeding demo menu (Buddha Bowl)...');
    const slug = 'buddha-bowl';
    const { data: mres, error: mErr } = await supabase.from('menu_makanan').insert({ restoran_id: restoranId, nama_menu: 'Buddha Bowl', deskripsi: 'Bowl sehat berisi sayuran, biji-bijian, dan protein nabati.', harga: 45000, foto: 'https://via.placeholder.com/400x300.png?text=Buddha+Bowl', kalori: 520, protein: 20, diet_claims: null, kategori_id: kategoriId, status_verifikasi: 'disetujui', slug, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select('id');
    if (mErr) throw mErr;
    console.log('Inserted menu_makanan id=', mres && mres[0] ? mres[0].id : null);

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message || err);
    process.exit(1);
  }
}

run();
