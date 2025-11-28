// scripts/inspect_restaurants.js
// Quick script to verify DB connectivity and print pending restorans rows.
const pool = require('../config/db');

(async function() {
  try {
    const [rows] = await pool.query(`SELECT id, nama_restoran, owner_name, owner_email, status_verifikasi, documents_json, created_at FROM restorans ORDER BY created_at DESC LIMIT 50`);
    console.log('Found', rows.length, 'restaurants. Sample:');
    rows.forEach(r => {
      console.log('---');
      console.log('id:', r.id);
      console.log('nama_restoran:', r.nama_restoran);
      console.log('owner_name:', r.owner_name);
      console.log('owner_email:', r.owner_email);
      console.log('status_verifikasi:', r.status_verifikasi);
      console.log('created_at:', r.created_at);
      console.log('documents_json:', r.documents_json);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error querying restorans:', err.message || err);
    process.exit(1);
  }
})();
