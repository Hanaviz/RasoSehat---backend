// scripts/add_slug_column.js
// Adds a `slug` column to `menu_makanan`, backfills canonical slugs,
// and creates a unique index. Safe for repeated runs.
const db = require('../config/db');
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
  const sql = `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'menu_makanan' AND COLUMN_NAME = 'slug'`;
  const [rows] = await db.execute(sql, [process.env.DB_NAME]);
  return rows[0].cnt > 0;
}

async function run() {
  try {
    console.log('Checking for existing `slug` column...');
    const exists = await columnExists();
    if (!exists) {
      console.log('Adding `slug` column to `menu_makanan`...');
      await db.execute("ALTER TABLE menu_makanan ADD COLUMN slug VARCHAR(255) DEFAULT NULL");
      console.log('Column added.');
    } else {
      console.log('`slug` column already exists.');
    }

    console.log('Fetching menu rows to backfill slug values...');
    const [rows] = await db.execute('SELECT id, nama_menu, slug FROM menu_makanan');
    console.log(`Found ${rows.length} rows.`);

    for (const row of rows) {
      const { id, nama_menu, slug } = row;
      if (slug && slug.toString().trim() !== '') continue; // already filled

      let candidate = slugify(nama_menu) || `menu-${id}`;

      // Ensure uniqueness: if candidate exists for another row, append id
      const [dup] = await db.execute('SELECT COUNT(*) as cnt FROM menu_makanan WHERE slug = ? AND id <> ?', [candidate, id]);
      if (dup[0].cnt > 0) {
        candidate = `${candidate}-${id}`;
      }

      await db.execute('UPDATE menu_makanan SET slug = ? WHERE id = ?', [candidate, id]);
      console.log(`Backfilled id=${id} -> ${candidate}`);
    }

    console.log('Attempting to add UNIQUE index on slug (allows multiple NULLs in MySQL)...');
    try {
      await db.execute('ALTER TABLE menu_makanan ADD UNIQUE INDEX idx_menu_slug (slug)');
      console.log('Unique index created on `slug`.');
    } catch (err) {
      if (err && err.code === 'ER_DUP_KEYNAME') {
        console.log('Unique index already exists.');
      } else if (err && err.errno === 1061) {
        console.log('Unique index already exists.');
      } else {
        console.warn('Could not create unique index automatically:', err.message);
        console.warn('You may need to create a unique index manually after resolving duplicates.');
      }
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
}

run();
