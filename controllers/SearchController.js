const supabase = require('../supabase/supabaseClient');
const cache = require('../utils/cache');

// Unified search controller as required by spec
// Returns unified results array for menus, restaurants and categories.
const search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const type = (req.query.type || 'all').toLowerCase();

    if (!q) return res.status(400).json({ success: false, message: 'Query parameter q is required', data: { query: q, results: [] } });

    const cacheKey = `search:unified:${type}:${q}`;
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch (e) { /* cache miss is fine */ }

    const results = [];
    const limitMenu = 20;
    const limitRest = 10;
    const limitCat = 8;

    // MENU search (FTS via existing RPC 'menu_search' if present)
    if (type === 'menu' || type === 'all') {
      try {
        const rpc = await supabase.rpc('menu_search', { query: q, lim: limitMenu });
        if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length) {
          const ids = rpc.data.map(r => r.id).filter(Boolean).slice(0, limitMenu);
          if (ids.length) {
            const { data: menus, error: menusErr } = await supabase.from('menu_makanan')
              .select('id,nama_menu,slug,harga,foto,deskripsi,rating,restorans(nama_restoran,slug),menu_diet_claims(diet_claims_list(id,nama))')
              .in('id', ids)
              .eq('status_verifikasi', 'disetujui')
              .limit(limitMenu);
            if (!menusErr && Array.isArray(menus)) {
              const byId = Object.fromEntries((menus || []).map(m => [m.id, m]));
              for (const id of ids) {
                const m = byId[id];
                if (!m) continue;
                results.push({
                  type: 'menu',
                  id: m.id,
                  name: m.nama_menu,
                  slug: m.slug,
                  restaurant: m.restorans?.nama_restoran || null,
                  restaurant_slug: m.restorans?.slug || null,
                  foto: m.foto || null,
                  healthTag: Array.isArray(m.menu_diet_claims) && m.menu_diet_claims.length ? (m.menu_diet_claims[0].diet_claims_list?.nama || null) : null,
                  description: m.deskripsi || null,
                  price: m.harga || null,
                  rating: typeof m.rating !== 'undefined' ? m.rating : null,
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('[SearchController] menu_search rpc failed, falling back to ILIKE', e?.message || e);
        // fallback to ILIKE
        try {
          const term = `%${q}%`;
          const { data: menus2, error: menus2Err } = await supabase.from('menu_makanan')
            .select('id,nama_menu,slug,harga,foto,deskripsi,rating,restorans(nama_restoran,slug),menu_diet_claims(diet_claims_list(id,nama)),diet_claims_old,bahan_baku_old')
            .or(`nama_menu.ilike.${term},deskripsi.ilike.${term},diet_claims_old.ilike.${term},bahan_baku_old.ilike.${term}`)
            .eq('status_verifikasi', 'disetujui')
            .limit(limitMenu);
          if (!menus2Err && Array.isArray(menus2)) {
            for (const m of menus2) {
              results.push({
                type: 'menu',
                id: m.id,
                name: m.nama_menu,
                slug: m.slug,
                restaurant: m.restorans?.nama_restoran || null,
                restaurant_slug: m.restorans?.slug || null,
                foto: m.foto || null,
                healthTag: Array.isArray(m.menu_diet_claims) && m.menu_diet_claims.length ? (m.menu_diet_claims[0].diet_claims_list?.nama || null) : null,
                description: m.deskripsi || null,
                price: m.harga || null,
                rating: typeof m.rating !== 'undefined' ? m.rating : null,
              });
            }
          }
        } catch (e2) { console.error('[SearchController] fallback menu ILIKE failed', e2); }
      }
    }

    // RESTAURANT search
    if (type === 'restaurant' || type === 'all') {
      try {
        const term = `%${q}%`;
        const { data: rests, error: restErr } = await supabase.from('restorans')
          .select('id,nama_restoran,slug,deskripsi')
          .or(`nama_restoran.ilike.${term},slug.ilike.${term}`)
          .limit(limitRest);
        if (!restErr && Array.isArray(rests)) {
          for (const r of rests) {
            results.push({
              type: 'restaurant',
              id: r.id,
              name: r.nama_restoran,
              slug: r.slug,
              description: r.deskripsi || null,
            });
          }
        }
      } catch (e) { console.error('[SearchController] restaurant search failed', e); }
    }

    // CATEGORY search
    if (type === 'category' || type === 'all') {
      try {
        const term = `%${q}%`;
        const { data: cats, error: catErr } = await supabase.from('kategori_makanan')
          .select('id,nama_kategori')
          .ilike('nama_kategori', term)
          .limit(limitCat);
        if (!catErr && Array.isArray(cats)) {
          for (const c of cats) {
            try {
              const cntResp = await supabase.from('menu_makanan')
                .select('id', { count: 'exact', head: true })
                .eq('kategori_id', c.id)
                .eq('status_verifikasi', 'disetujui');
              const count = cntResp && typeof cntResp.count === 'number' ? cntResp.count : 0;
              results.push({
                type: 'category',
                id: c.id,
                name: c.nama_kategori,
                count: count,
              });
            } catch (eCount) {
              results.push({ type: 'category', id: c.id, name: c.nama_kategori, count: 0 });
            }
          }
        }
      } catch (e) { console.error('[SearchController] category search failed', e); }
    }

    const payload = { query: q, results };
    try { await cache.set(cacheKey, JSON.stringify(payload), 60); } catch (e) { /* ignore cache errors */ }

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[SearchController] error', err);
    return res.status(500).json({ success: false, message: 'Internal server error', data: { query: req.query.q || '', results: [] } });
  }
};

module.exports = { search };
