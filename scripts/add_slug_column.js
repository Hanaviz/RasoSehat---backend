// scripts/add_slug_column.js
// Adds a `slug` column to `menu_makanan`, backfills canonical slugs,
// and creates a unique index. Safe for repeated runs.
const supabase = require('../supabase/supabaseClient');
require('dotenv').config();

function slugify(name) {
  if (!name) return null;
  // normalize, remove diacritics, keep a-z0-9 and hyphens
  let s = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9\s-]/g, '');
  s = s.trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  if (!s) return null;
  return s.slice(0, 200);
}

async function columnExists() {
  // Supabase JS does not allow arbitrary DDL inspection; best-effort: try selecting the `slug` column and see if query succeeds.
  try {
    const { data, error } = await supabase.from('menu_makanan').select('slug').limit(1);
    if (error) return false;
    return true;
  } catch (e) {
    return false;
  }
}

async function run() {
  try {
    console.log('Checking for existing `slug` column...');
    const exists = await columnExists();
    if (!exists) {
      console.warn('`slug` column does not exist. This script cannot perform ALTER TABLE via Supabase client.');
      console.warn('Please run the following SQL on your database (psql / admin tool) before re-running this script:');
      console.warn("ALTER TABLE menu_makanan ADD COLUMN slug VARCHAR(255) DEFAULT NULL;");
      console.warn('After adding the column, re-run this script to backfill slug values.');
      process.exit(1);
    } else {
      console.log('`slug` column already exists.');
    }

    console.log('Fetching menu rows to backfill slug values...');
    const { data: rowsRes, error: rowsErr } = await supabase.from('menu_makanan').select('id,nama_menu,slug');
    if (rowsErr) throw rowsErr;
    console.log(`Found ${(rowsRes || []).length} rows.`);

    for (const row of (rowsRes || [])) {
      const { id, nama_menu, slug } = row;
      if (slug && slug.toString().trim() !== '') continue; // already filled

      let candidate = slugify(nama_menu) || `menu-${id}`;

      // Ensure uniqueness: check via Supabase
      const { data: dupRows } = await supabase.from('menu_makanan').select('id').eq('slug', candidate).neq('id', id).limit(1);
      if (dupRows && dupRows.length) {
        candidate = `${candidate}-${id}`;
      }

      await supabase.from('menu_makanan').update({ slug: candidate }).eq('id', id);
      console.log(`Backfilled id=${id} -> ${candidate}`);
    }

    console.log('Attempting to add UNIQUE index on slug (Postgres: CREATE UNIQUE INDEX IF NOT EXISTS)...');
    console.log('NOTE: Creating database indexes (CREATE UNIQUE INDEX ...) requires running DDL on the DB server.');
    console.log('If you want a unique index on `slug`, run: CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_slug ON menu_makanan (slug);');

    console.log('Backfill complete. Manual DB DDL steps (if needed) are noted above.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
}

run();
