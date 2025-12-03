const db = require('./config/db');

(async () => {
  try {
    const slug = 'buddha-bowl';
    const qSlug = `
        SELECT
            m.*, r.nama_restoran, r.alamat, r.no_telepon,
            r.latitude, r.longitude
        FROM menu_makanan m
        JOIN restorans r ON m.restoran_id = r.id
        WHERE m.slug = ? AND m.status_verifikasi = 'disetujui' LIMIT 1
    `;
    const [rows] = await db.execute(qSlug, [slug]);
    console.log('Query result:', rows);
    console.log('Rows length:', rows.length);
    if (rows.length > 0) {
      console.log('First row:', rows[0]);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
})();