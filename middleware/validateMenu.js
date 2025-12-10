const supabase = require('../supabase/supabaseClient');

// Basic request validation for menu payloads
module.exports = async function validateMenu(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.nama_menu && req.method === 'POST') return res.status(400).json({ error: true, message: 'nama_menu wajib.' });
    if (body.kategori_id) {
      const { data, error } = await supabase.from('kategori_makanan').select('id').eq('id', body.kategori_id).limit(1);
      if (error) return res.status(400).json({ error: true, message: 'kategori_id lookup error', details: error });
      if (!data || !data.length) return res.status(400).json({ error: true, message: 'kategori_id tidak ditemukan.' });
    }
    if (body.restoran_id) {
      const { data, error } = await supabase.from('restorans').select('id').eq('id', body.restoran_id).limit(1);
      if (error) return res.status(400).json({ error: true, message: 'restoran_id lookup error', details: error });
      if (!data || !data.length) return res.status(400).json({ error: true, message: 'restoran_id tidak ditemukan.' });
    }
    // numeric fields validation
    const numericFields = ['kalori','protein','gula','lemak','serat','lemak_jenuh','harga'];
    for (const f of numericFields) {
      if (typeof body[f] !== 'undefined' && body[f] !== null && body[f] !== '') {
        const v = Number(body[f]);
        if (Number.isNaN(v)) return res.status(400).json({ error: true, message: `Field ${f} harus numerik.` });
      }
    }
    next();
  } catch (e) {
    next(e);
  }
};
