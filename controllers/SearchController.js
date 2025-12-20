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

    // Implement menu, restaurant, or combined search
    const searchPattern = `%${q}%`;

    // Helper: count matching rows for a table using head:true
    const countMatches = async (table, orCondition) => {
      const resp = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .or(orCondition)
        .eq('status_verifikasi', 'disetujui');
      return resp.count || 0;
    };

    // If only menu requested -> keep existing behavior unchanged
    if (type === 'menu') {
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
        console.error('[SearchController] Database error (menu):', error);
        return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [], total: 0, page, limit } });
      }

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

      return res.json({ success: true, data: { query: q, results, total: typeof count === 'number' ? count : results.length, page, limit } });
    }

    // If only restaurant requested -> search restorans
    if (type === 'restaurant') {
      // count + fetch restaurants with pagination
      const { data: restos, error, count } = await supabase
        .from('restorans')
        .select(`id, nama_restoran, slug, deskripsi, foto, rating`, { count: 'exact' })
        .or(`nama_restoran.ilike.${searchPattern},slug.ilike.${searchPattern}`)
        .eq('status_verifikasi', 'disetujui')
        .order('nama_restoran', { ascending: true })
        .range(from, to);

      if (error) {
        console.error('[SearchController] Database error (restaurant):', error);
        return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [], total: 0, page, limit } });
      }

      const results = (restos || []).map(r => ({
        type: 'restaurant',
        id: r.id,
        name: r.nama_restoran,
        slug: r.slug,
        description: r.deskripsi || '',
        foto: r.foto || null,
        rating: r.rating || 0
      }));

      return res.json({ success: true, data: { query: q, results, total: typeof count === 'number' ? count : results.length, page, limit } });
    }

    // type === 'all' -> combined results (menu first, then restaurant)
    if (type === 'all') {
      // get counts for both
      const menuCount = await countMatches('menu_makanan', `nama_menu.ilike.${searchPattern},slug.ilike.${searchPattern}`);
      const restoCount = await countMatches('restorans', `nama_restoran.ilike.${searchPattern},slug.ilike.${searchPattern}`);
      const combinedTotal = (menuCount || 0) + (restoCount || 0);

      // Calculate which slices to fetch from each table to satisfy page/limit across combined list
      const combinedFrom = from;
      const combinedLimit = limit;

      let menusToFetch = { from: 0, to: -1, limit: 0, offset: 0 };
      let restosToFetch = { from: 0, to: -1, limit: 0, offset: 0 };

      if (combinedFrom >= menuCount) {
        // Skip menus entirely, only fetch restaurants
        restosToFetch.offset = combinedFrom - menuCount;
        restosToFetch.limit = combinedLimit;
      } else {
        // Take menus starting at combinedFrom
        const availableMenus = menuCount - combinedFrom;
        const takeMenus = Math.min(availableMenus, combinedLimit);
        menusToFetch.offset = combinedFrom;
        menusToFetch.limit = takeMenus;

        const remaining = combinedLimit - takeMenus;
        if (remaining > 0) {
          restosToFetch.offset = 0;
          restosToFetch.limit = remaining;
        }
      }

      // Fetch menus slice if needed
      let menuResults = [];
      if (menusToFetch.limit > 0) {
        const { data: menus, error: mErr } = await supabase
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
          `)
          .or(`nama_menu.ilike.${searchPattern},slug.ilike.${searchPattern}`)
          .eq('status_verifikasi', 'disetujui')
          .order('rating', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .range(menusToFetch.offset, menusToFetch.offset + menusToFetch.limit - 1);

        if (mErr) {
          console.error('[SearchController] Database error (menu slice):', mErr);
          return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [], total: 0, page, limit } });
        }

        menuResults = (menus || []).map(menu => ({
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
      }

      // Fetch restaurants slice if needed
      let restoResults = [];
      if (restosToFetch.limit > 0) {
        const { data: restos, error: rErr } = await supabase
          .from('restorans')
          .select(`id, nama_restoran, slug, deskripsi, foto, rating`)
          .or(`nama_restoran.ilike.${searchPattern},slug.ilike.${searchPattern}`)
          .eq('status_verifikasi', 'disetujui')
          .order('nama_restoran', { ascending: true })
          .range(restosToFetch.offset, restosToFetch.offset + restosToFetch.limit - 1);

        if (rErr) {
          console.error('[SearchController] Database error (resto slice):', rErr);
          return res.status(500).json({ success: false, message: 'Failed to perform search', data: { query: q, results: [], total: 0, page, limit } });
        }

        restoResults = (restos || []).map(r => ({
          type: 'restaurant',
          id: r.id,
          name: r.nama_restoran,
          slug: r.slug,
          description: r.deskripsi || '',
          foto: r.foto || null,
          rating: r.rating || 0
        }));
      }

      const results = [...menuResults, ...restoResults];

      return res.json({ success: true, data: { query: q, results, total: combinedTotal, page, limit } });
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