// quick DB inspector for menu_makanan (Supabase)
const supabase = require('../supabase/supabaseClient');

(async () => {
  try {
    console.log('Querying sample rows from menu_makanan...');
    const { data: rows, error: rowsErr } = await supabase.from('menu_makanan').select('id,nama_menu,status_verifikasi,harga,foto').limit(30);
    if (rowsErr) throw rowsErr;
    console.log('Sample rows (up to 30):');
    console.table(rows || []);

    const { count, error: countErr } = await supabase.from('menu_makanan').select('id', { count: 'exact', head: true }).eq('status_verifikasi', 'disetujui');
    if (countErr) throw countErr;
    console.log(`Approved menus count: ${count}`);

    const slug = 'buddha-bowl';
    console.log(`Searching for slug-like entries matching: ${slug}`);
    // Best-effort search: match slug or name-ilike
    const { data: matchRows, error: matchErr } = await supabase.from('menu_makanan')
      .select('id,nama_menu,status_verifikasi')
      .or(`slug.ilike.%${slug}%,nama_menu.ilike.%${slug.replace(/-/g, ' ')}%`)
      .limit(20);
    if (matchErr) throw matchErr;
    console.log('Slug-like matches:');
    console.table(matchRows || []);

    process.exit(0);
  } catch (err) {
    console.error('Error querying DB:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
