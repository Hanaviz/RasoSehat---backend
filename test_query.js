const supabase = require('./supabase/supabaseClient');

(async () => {
  try {
    const slug = 'buddha-bowl';
    const { data: menus, error } = await supabase.from('menu_makanan').select('*, restorans(id,nama_restoran,alamat,no_telepon,latitude,longitude)').eq('slug', slug).eq('status_verifikasi', 'disetujui').limit(1);
    if (error) throw error;
    console.log('Query result:', menus);
    console.log('Rows length:', (menus || []).length);
    if (menus && menus.length > 0) console.log('First row:', menus[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
})();