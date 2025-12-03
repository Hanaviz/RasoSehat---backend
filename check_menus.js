const db = require('./config/db');

(async () => {
  try {
    const [menus] = await db.execute('SELECT id, nama_menu, slug, status_verifikasi FROM menu_makanan LIMIT 10');
    console.log('Available menus:');
    menus.forEach(menu => console.log(`ID: ${menu.id}, Name: ${menu.nama_menu}, Slug: ${menu.slug}, Status: ${menu.status_verifikasi}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
})();