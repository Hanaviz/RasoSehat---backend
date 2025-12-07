// scripts/inspect_restaurants.js
// Quick script to verify DB connectivity and print pending restorans rows.
const supabase = require('../supabase/supabaseClient');
require('dotenv').config();

(async function() {
  try {
    const { data: rows, error } = await supabase.from('restorans').select('id,nama_restoran,owner_name,owner_email,status_verifikasi,documents_json,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    console.log('Found', (rows || []).length, 'restaurants. Sample:');
    (rows || []).forEach(r => {
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
