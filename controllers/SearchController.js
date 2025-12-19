const supabase = require('../supabase/supabaseClient');

/**
 * Search Controller - Simple ILIKE-based search
 * Searches menu_makanan.nama_menu and slug columns
 * Only returns verified menus (status_verifikasi = 'disetujui')
 */
const search = async (req, res) => {
  try {
    // Validate query parameter
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        message: 'Query parameter q is required', 
        data: { 
          query: q, 
          results: [], 
          total: 0,
          page: 1,
          limit: 24
        } 
      });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Parse search type (default to 'menu')
    const type = (req.query.type || 'menu').toString().toLowerCase();

    console.log(`[SearchController] Searching for: "${q}", type: ${type}, page: ${page}, limit: ${limit}`);

    // Only menu search is implemented
    if (type === 'menu' || type === 'all') {
      // Build ILIKE pattern for case-insensitive search
      const searchPattern = `%${q}%`;
      
      // Query with exact count for pagination
      const { data: menus, error, count } = await supabase
        .from('menu_makanan')
        .select(`
          id,
          nama_menu,
          slug,
          deskripsi,
          harga,
          rating,
          foto,
          restorans!inner(
            nama_restoran,
            slug
          )
        `, { count: 'exact' })
        .or(`nama_menu.ilike.${searchPattern},slug.ilike.${searchPattern}`)
        .eq('status_verifikasi', 'disetujui')
        .order('rating', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('[SearchController] Database error:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to perform search', 
          data: { 
            query: q, 
            results: [],
            total: 0,
            page,
            limit
          } 
        });
      }

      // Transform results to frontend format
      const results = (menus || []).map(menu => ({
        type: 'menu',
        id: menu.id,
        name: menu.nama_menu,
        slug: menu.slug,
        description: menu.deskripsi || '',
        price: menu.harga || 0,
        rating: menu.rating || 0,
        foto: menu.foto || null,
        restaurant: menu.restorans?.nama_restoran || '',
        restaurant_slug: menu.restorans?.slug || ''
      }));

      console.log(`[SearchController] Found ${results.length} results (total: ${count})`);

      return res.json({ 
        success: true, 
        data: { 
          query: q, 
          results, 
          total: typeof count === 'number' ? count : results.length, 
          page, 
          limit 
        } 
      });
    }

    // Fallback for unsupported types
    return res.json({ 
      success: true, 
      data: { 
        query: q, 
        results: [], 
        total: 0, 
        page, 
        limit 
      } 
    });

  } catch (err) {
    console.error('[SearchController] Unexpected error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      data: { 
        query: req.query.q || '', 
        results: [],
        total: 0,
        page: 1,
        limit: 24
      } 
    });
  }
};

module.exports = { search };