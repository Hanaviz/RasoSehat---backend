// Simple audit script: list menu_makanan and restorans rows where foto_path IS NULL but legacy foto is present
// Usage: node scripts/audit_missing_photo_paths.js

const supabase = require('../supabase/supabaseClient');

(async function main(){
  try {
    console.log('Checking menu_makanan for missing foto_path...');
    const { data: menus, error: menusErr } = await supabase.from('menu_makanan').select('id,nama_menu,foto,foto_path').not('foto','is',null).is('foto_path',null).limit(1000);
    if (menusErr) { console.error('menus query error', menusErr); }
    console.log('Menus with legacy foto but no foto_path:', menus && menus.length ? menus.length : 0);
    if (menus && menus.length) console.table(menus);

    console.log('\nChecking restorans for missing foto_path...');
    const { data: restos, error: restosErr } = await supabase.from('restorans').select('id,nama_restoran,foto,foto_path').not('foto','is',null).is('foto_path',null).limit(1000);
    if (restosErr) { console.error('restos query error', restosErr); }
    console.log('Restorans with legacy foto but no foto_path:', restos && restos.length ? restos.length : 0);
    if (restos && restos.length) console.table(restos);

    console.log('\nAudit complete.');
    process.exit(0);
  } catch (e) {
    console.error('Audit failed', e);
    process.exit(2);
  }
})();
