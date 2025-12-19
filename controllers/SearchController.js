const supabase = require('../supabase/supabaseClient');

// Simple, controlled search implementation per spec:
// - Only search `menu_makanan.nama_menu` using ILIKE
// - Do NOT use RPC/FTS/search_vector
// - Only return menus (status_verifikasi = 'disetujui')
// - Single endpoint: GET /api/search?q=...
const search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, message: 'Query parameter q is required', data: { query: q, results: [] } });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 24);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const term = q;
    const type = (req.query.type || 'menu').toString().toLowerCase();

    // Request exact count and a paginated range for efficient client-side paging
    // For menu searches we search both `nama_menu` and `slug` (ILIKE)
    if (type === 'menu' || type === 'all') {
      const ilikeExpr = `nama_menu.ilike.'%${term}%' , slug.ilike.'%${term}%'`;
      const { data: menus, error, count } = await supabase
        .from('menu_makanan')
        .select('id,nama_menu,slug,deskripsi,harga,rating,foto,restorans(nama_restoran,slug)', { count: 'exact' })
        .or(ilikeExpr)
        .eq('status_verifikasi', 'disetujui')
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('[SearchController] menu ILIKE query error', error);
        return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [] } });
      }

      const results = (menus || []).map(m => ({
        type: 'menu',
        id: m.id,
        name: m.nama_menu,
        slug: m.slug,
        description: m.deskripsi || null,
        price: m.harga || null,
        rating: typeof m.rating !== 'undefined' && m.rating !== null ? m.rating : null,
        foto: m.foto || null,
        restaurant: m.restorans?.nama_restoran || null,
        restaurant_slug: m.restorans?.slug || null
      }));

      // Return pagination metadata to the client
      return res.json({ success: true, data: { query: q, results, total: typeof count === 'number' ? count : results.length, page, limit } });
    }

    // Fallback: no other types implemented yet
    return res.json({ success: true, data: { query: q, results: [], total: 0, page, limit } });

    if (error) {
      console.error('[SearchController] menu ILIKE query error', error);
      return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [] } });
    }

    const results = (menus || []).map(m => ({
      type: 'menu',
      id: m.id,
      name: m.nama_menu,
      slug: m.slug,
      description: m.deskripsi || null,
      price: m.harga || null,
      rating: typeof m.rating !== 'undefined' && m.rating !== null ? m.rating : null,
      foto: m.foto || null,
      restaurant: m.restorans?.nama_restoran || null,
      restaurant_slug: m.restorans?.slug || null
    }));

    // Return pagination metadata to the client
    return res.json({ success: true, data: { query: q, results, total: typeof count === 'number' ? count : results.length, page, limit } });
  } catch (err) {
    console.error('[SearchController] unexpected error', err);
    return res.status(500).json({ success: false, message: 'Internal server error', data: { query: req.query.q || '', results: [] } });
  }
};

module.exports = { search };
