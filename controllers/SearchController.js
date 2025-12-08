const supabase = require('../supabase/supabaseClient');
const cache = require('../utils/cache');

// Normalize a restaurant row to the unified search result shape
function normalizeRestaurant(r) {
  return {
    id: r.id,
    type: 'restaurant',
    name: r.nama_restoran || r.name || '',
    description: r.deskripsi || r.alamat || '',
    image: (r.foto && r.foto.startsWith && r.foto.startsWith('/')) ? r.foto : (r.foto || null),
    rating: r.rating || null,
    meta: { slug: r.slug }
  };
}

function normalizeMenu(m) {
  return {
    id: m.id,
    type: 'menu',
    name: m.nama_menu || m.name || '',
    description: m.deskripsi || '',
    image: m.foto || null,
    rating: m.rating || null,
    meta: { restaurantId: m.restaurant_id, restaurantName: m.restaurant_name }
  };
}

function normalizeCategory(c) {
  return {
    id: c.id,
    type: 'category',
    name: c.name || c.nama || '',
    description: c.description || '',
    image: c.image || null,
    rating: null,
    meta: {}
  };
}

const search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const cacheKey = `search:${q}`;

    // Serve cached response when available
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const limitPer = 5;
    const results = [];

    if (!q) {
      // If no query, return trending (top menus) and empty results
      const { data: trendingMenus } = await supabase.from('menus').select('*').order('rating', { ascending: false }).limit(5);
      const payload = { results: [], trending: (trendingMenus || []).map(normalizeMenu), history: [] };
      await cache.set(cacheKey, JSON.stringify(payload), 30);
      return res.json(payload);
    }

    // Simple ILIKE-based fallback search across tables
    const qLike = `%${q.replace(/%/g, '')}%`;

    const [{ data: restaurants }, { data: menus }, { data: categories }] = await Promise.all([
      supabase.from('restorans').select('*').or(`nama_restoran.ilike.${qLike},deskripsi.ilike.${qLike}`).limit(limitPer),
      supabase.from('menus').select('*').or(`nama_menu.ilike.${qLike},deskripsi.ilike.${qLike}`).limit(limitPer),
      supabase.from('categories').select('*').or(`name.ilike.${qLike},description.ilike.${qLike}`).limit(limitPer)
    ]);

    if (restaurants && restaurants.length) results.push(...restaurants.map(normalizeRestaurant));
    if (menus && menus.length) results.push(...menus.map(normalizeMenu));
    if (categories && categories.length) results.push(...categories.map(normalizeCategory));

    // simple ranking: restaurants first, then menus, then categories
    results.sort((a, b) => {
      const order = { restaurant: 0, menu: 1, category: 2 };
      return (order[a.type] - order[b.type]);
    });

    // trending (top menus)
    const { data: trending } = await supabase.from('menus').select('*').order('rating', { ascending: false }).limit(5);

    const response = { results, trending: (trending || []).map(normalizeMenu), history: [] };
    await cache.set(cacheKey, JSON.stringify(response), 45);
    return res.json(response);
  } catch (err) {
    console.error('search error', err?.message || err);
    return res.status(500).json({ message: 'Internal search error' });
  }
};

module.exports = { search };
