const supabase = require('../supabase/supabaseClient');

(async () => {
  try {
    const slug = 'demo-1';

    // Check if slug already exists
    const { data: existRows, error: existErr } = await supabase.from('menu_makanan').select('id,slug,nama_menu').eq('slug', slug).limit(1);
    if (existErr) throw existErr;
    if (existRows && existRows.length) {
      console.log('Slug already exists:', existRows[0]);
      process.exit(0);
    }

    // Insert a demo menu (associate to restoran_id 1 and kategori_id 6 if available)
    const restoranId = 1;
    const kategoriId = 6;
    const namaMenu = 'Demo Menu 1';
    const deskripsi = 'Menu demo untuk pengujian (demo-1).';
    const dietClaims = [];
    const harga = 35000.00;
    const foto = 'https://via.placeholder.com/400x300.png?text=Demo+Menu+1';

    const MenuModel = require('../models/MenuModel');
    const { syncMenuBahan, syncMenuDietClaims } = require('../utils/pivotHelper');
    const insertPayload = {
      restoran_id: restoranId,
      kategori_id: kategoriId,
      nama_menu: namaMenu,
      deskripsi,
      metode_masak: null,
      kalori: 400,
      protein: 12.0,
      gula: 0.0,
      lemak: 5.0,
      serat: 3.0,
      lemak_jenuh: 1.0,
      harga,
      foto,
      status_verifikasi: 'disetujui',
      slug
    };
    const created = await MenuModel.create(insertPayload);
    if (!created || !created.id) throw new Error('Failed to insert demo menu');
    // attach simple pivots
    try {
      await syncMenuBahan(created.id, ['demo ingredient']);
      await syncMenuDietClaims(created.id, ['demo']);
    } catch (e) { console.warn('pivot sync warning', e); }
    console.log('Inserted demo menu id:', created.id);

    const { data: rowsRes, error: rowsErr } = await supabase.from('menu_makanan').select('id,nama_menu,slug,status_verifikasi').eq('id', newId).limit(1);
    if (rowsErr) throw rowsErr;
    console.log('Inserted row:', rowsRes && rowsRes[0] ? rowsRes[0] : null);
  } catch (err) {
    console.error('Error inserting demo menu:', err && err.stack ? err.stack : err);
  } finally {
    process.exit();
  }
})();
