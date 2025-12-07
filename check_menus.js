const supabase = require('./supabase/supabaseClient');

(async () => {
  try {
    const { data: menus, error } = await supabase.from('menu_makanan').select('id,nama_menu,slug,status_verifikasi').limit(10);
    if (error) throw error;
    console.log('Available menus:');
    (menus || []).forEach(menu => console.log(`ID: ${menu.id}, Name: ${menu.nama_menu}, Slug: ${menu.slug}, Status: ${menu.status_verifikasi}`));
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
  } finally {
    process.exit();
  }
})();