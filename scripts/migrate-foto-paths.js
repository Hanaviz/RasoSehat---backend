/**
 * Migration script to fix menu foto paths
 * 
 * Problem: Existing menus have local paths in `foto` field (e.g., "/uploads/menu/123.jpg")
 * but `foto_path` and `foto_storage_provider` are null. The files are already uploaded
 * to Supabase storage, but the database doesn't have the correct public URLs.
 * 
 * Solution: Convert local paths to Supabase public URLs and update the database.
 */

require('dotenv').config();
const supabase = require('../supabase/supabaseClient');
const { buildPublicUrlFromStoredPath } = require('../utils/storageHelper');

async function migrateFotoPaths() {
  console.log('Starting foto path migration...\n');

  // Get all menus where foto_path is null but foto is not null
  const { data: menus, error: fetchError } = await supabase
    .from('menu_makanan')
    .select('id, nama_menu, foto, foto_path, foto_storage_provider')
    .is('foto_path', null)
    .not('foto', 'is', null);

  if (fetchError) {
    console.error('Error fetching menus:', fetchError);
    return;
  }

  if (!menus || menus.length === 0) {
    console.log('No menus found that need migration.');
    return;
  }

  console.log(`Found ${menus.length} menus to migrate:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const menu of menus) {
    console.log(`Processing menu ID ${menu.id}: "${menu.nama_menu}"`);
    console.log(`  Current foto: ${menu.foto}`);

    try {
      // Build the Supabase public URL from the stored path
      const publicUrl = buildPublicUrlFromStoredPath(menu.foto);

      if (!publicUrl) {
        console.log(`  ⚠️  Could not build public URL for: ${menu.foto}`);
        errorCount++;
        continue;
      }

      console.log(`  New foto_path: ${publicUrl}`);

      // Update the database
      const { error: updateError } = await supabase
        .from('menu_makanan')
        .update({
          foto_path: publicUrl,
          foto_storage_provider: 'supabase'
        })
        .eq('id', menu.id);

      if (updateError) {
        console.log(`  ❌ Error updating menu ${menu.id}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`  ✅ Successfully updated menu ${menu.id}`);
        successCount++;
      }
    } catch (err) {
      console.log(`  ❌ Exception processing menu ${menu.id}:`, err.message);
      errorCount++;
    }

    console.log(''); // blank line for readability
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total menus processed: ${menus.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the migration
migrateFotoPaths()
  .then(() => {
    console.log('\nMigration completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
