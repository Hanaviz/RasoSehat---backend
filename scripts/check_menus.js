// quick DB inspector for menu_makanan
const db = require('../config/db');

(async () => {
  try {
    console.log('Querying sample rows from menu_makanan...');
    const [rows] = await db.execute('SELECT id, nama_menu, status_verifikasi, harga, foto FROM menu_makanan LIMIT 30');
    console.log('Sample rows (up to 30):');
    console.table(rows);

    const [countRows] = await db.execute("SELECT COUNT(*) as cnt FROM menu_makanan WHERE status_verifikasi = 'disetujui'");
    console.log(`Approved menus count: ${countRows[0].cnt}`);

    const slug = 'buddha-bowl';
    console.log(`Searching for slug-like entries matching: ${slug}`);
    const [matchRows] = await db.execute(
      "SELECT id, nama_menu, status_verifikasi FROM menu_makanan WHERE LOWER(REPLACE(nama_menu, ' ', '-')) LIKE ? OR nama_menu LIKE ? LIMIT 20",
      [`%${slug}%`, `%${slug.replace(/-/g, ' ')}%`]
    );
    console.log('Slug-like matches:');
    console.table(matchRows);

    process.exit(0);
  } catch (err) {
    console.error('Error querying DB:', err.message);
    process.exit(1);
  }
})();
