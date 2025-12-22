const supabase = require('../supabase/supabaseClient');
const { buildPublicUrlFromStoredPath } = require('../utils/storageHelper');

const slugify = (text) => {
    if (!text) return null;
    return text.toString().toLowerCase()
        .normalize('NFKD')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/\-+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const safeParseClaims = (val) => {
    // kept for backward compatibility but new schema uses pivot tables
    let claims = [];
    try {
        claims = val ? (typeof val === 'object' ? val : JSON.parse(val)) : [];
    } catch (e) {
        try { claims = String(val).split(',').map(s => s.trim()).filter(Boolean); } catch (e2) { claims = []; }
    }
    return claims;
};

const MenuModel = {
    // Hydrate a raw Supabase row (with nested joins) into canonical API shape
    getMenuHydrated: (r) => {
        if (!r) return null;
        // Prefer `foto_path` (new column) but keep `foto` for backward compatibility
        const rawFoto = r.foto_path || r.foto || null;
        let finalFotoPath = null;
        let finalProvider = null;
        try {
            if (rawFoto && /^https?:\/\//i.test(String(rawFoto))) {
                finalFotoPath = String(rawFoto).trim();
                const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                finalProvider = SUPABASE_URL && finalFotoPath.includes(SUPABASE_URL) ? 'supabase' : 'external';
            } else if (rawFoto) {
                const pub = buildPublicUrlFromStoredPath(rawFoto);
                if (pub) {
                    finalFotoPath = pub;
                    finalProvider = 'supabase';
                } else {
                    finalFotoPath = null;
                    finalProvider = null;
                }
            }
        } catch (e) { finalFotoPath = null; finalProvider = null; }

        return {
            id: r.id,
            nama_menu: r.nama_menu,
            slug: r.slug,
            harga: r.harga,
            // expose both new and legacy fields (but ensure foto_path is a public URL or null)
            foto: r.foto || null,
            foto_path: finalFotoPath,
            foto_storage_provider: finalProvider,
            status_verifikasi: r.status_verifikasi,
            kategori: r.kategori_makanan ? { id: r.kategori_id || null, nama_kategori: r.kategori_makanan?.nama_kategori || null } : (r.kategori_id ? { id: r.kategori_id } : null),
            restoran: r.restorans ? { id: r.restorans.id || r.restoran_id, nama_restoran: r.restorans.nama_restoran || null, alamat: r.restorans.alamat || null, no_telepon: r.restorans.no_telepon || null, latitude: r.restorans.latitude || null, longitude: r.restorans.longitude || null, slug: r.restorans.slug || null } : (r.restoran_id ? { id: r.restoran_id } : null),
            bahan_baku: Array.isArray(r.menu_bahan_baku) ? r.menu_bahan_baku.map(m => m.bahan_baku) : [],
            diet_claims: Array.isArray(r.menu_diet_claims) ? r.menu_diet_claims.map(m => m.diet_claims_list) : [],
            nutrition: {
                 kalori: typeof r.kalori !== 'undefined' && r.kalori !== null ? r.kalori : null,
                 protein: typeof r.protein !== 'undefined' && r.protein !== null ? r.protein : null,
                 gula: typeof r.gula !== 'undefined' && r.gula !== null ? r.gula : null,
                 lemak: typeof r.lemak !== 'undefined' && r.lemak !== null ? r.lemak : null,
                 serat: typeof r.serat !== 'undefined' && r.serat !== null ? r.serat : null,
                 lemak_jenuh: typeof r.lemak_jenuh !== 'undefined' && r.lemak_jenuh !== null ? r.lemak_jenuh : null,
                 karbohidrat: typeof r.karbohidrat !== 'undefined' && r.karbohidrat !== null ? r.karbohidrat : null,
                 kolesterol: typeof r.kolesterol !== 'undefined' && r.kolesterol !== null ? r.kolesterol : null,
                 natrium: typeof r.natrium !== 'undefined' && r.natrium !== null ? r.natrium : null
            },
            deskripsi: r.deskripsi || null,
            metode_masak: r.metode_masak || null,
            created_at: r.created_at || null,
            updated_at: r.updated_at || null,
            kategori_id: r.kategori_id || null,
            restoran_id: r.restoran_id || (r.restorans && r.restorans.id) || null
        };
    },
    // Get featured menus (preserve shape: include restoran.nama_restoran, restoran.alamat)
    getFeaturedMenus: async (limit = 10) => {
        const cache = require('../utils/cache');
        const cacheKey = `featured_menus:${limit}`;
        try {
            const cached = await cache.get(cacheKey);
            if (cached) return cached;
        } catch (e) { /* ignore cache errors */ }
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama,deskripsi,is_alergen)), menu_diet_claims(diet_claims_list(id,nama,deskripsi))')
            .eq('status_verifikasi', 'disetujui')
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('getFeaturedMenus error', error); return []; }
        const mapped = (data || []).map(r => MenuModel.getMenuHydrated(r));
        try { await cache.set(cacheKey, mapped, 300); } catch (e) { /* ignore */ }
        return mapped;
    },

    // Legacy menu-specific search logic removed. Use unified `/api/search`
    // endpoint implemented in `controllers/searchController.js` instead.

    // List all menus with category and restoran info
    findAll: async () => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama)), menu_diet_claims(diet_claims_list(id,nama))')
            .order('updated_at', { ascending: false });
        if (error) { console.error('findAll error', error); return []; }
        return (data || []).map(r => MenuModel.getMenuHydrated(r));
    },

    // List all approved menus
    findAllApproved: async () => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama)), menu_diet_claims(diet_claims_list(id,nama))')
            .eq('status_verifikasi', 'disetujui')
            .order('updated_at', { ascending: false });
        if (error) { console.error('findAllApproved error', error); return []; }
        return (data || []).map(r => MenuModel.getMenuHydrated(r));
    },

    // Detail menu (approved)
    getMenuDetail: async (id) => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude,slug), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama,deskripsi,is_alergen)), menu_diet_claims(diet_claims_list(id,nama,deskripsi))')
            .eq('id', id)
            .limit(1)
            .single();
        if (error) { console.error('getMenuDetail error', error); return null; }
        const r = data;
        if (!r) return null;
        return MenuModel.getMenuHydrated(r);
    },

    // Variant: return menu detail regardless of status_verifikasi (for create/update flows)
    getMenuDetailById: async (id) => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude,slug), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama,deskripsi,is_alergen)), menu_diet_claims(diet_claims_list(id,nama,deskripsi))')
            .eq('id', id)
            .limit(1)
            .single();
        if (error) { console.error('getMenuDetailById error', error); return null; }
        const r = data;
        if (!r) return null;
        return {
            id: r.id,
            restoran_id: r.restoran_id,
            kategori_id: r.kategori_id,
            nama_menu: r.nama_menu,
            deskripsi: r.deskripsi,
            harga: r.harga,
            foto: r.foto || null,
            foto_path: (function(){
                const raw = r.foto_path || r.foto || null;
                try {
                    if (!raw) return null;
                    if (/^https?:\/\//i.test(String(raw))) return String(raw).trim();
                    return buildPublicUrlFromStoredPath(raw) || null;
                } catch(e) { return null; }
            })(),
            foto_storage_provider: (function(){
                const v = (r.foto_path || r.foto || null);
                try {
                    if (!v) return null;
                    if (/^https?:\/\//i.test(String(v))) {
                        const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                        return SUPABASE_URL && String(v).includes(SUPABASE_URL) ? 'supabase' : 'external';
                    }
                    // if we can build a public url, treat as supabase
                    const pub = buildPublicUrlFromStoredPath(v);
                    return pub ? 'supabase' : null;
                } catch (e) { return null; }
            })(),
            slug: r.slug,
            status_verifikasi: r.status_verifikasi,
            kalori: r.kalori,
                karbohidrat: r.karbohidrat,
            protein: r.protein,
            gula: r.gula,
            lemak: r.lemak,
            serat: r.serat,
            lemak_jenuh: r.lemak_jenuh,
                kolesterol: r.kolesterol,
                natrium: r.natrium,
            nama_restoran: r.restorans?.nama_restoran || null,
            alamat: r.restorans?.alamat || null,
            no_telepon: r.restorans?.no_telepon || null,
            latitude: r.restorans?.latitude || null,
            longitude: r.restorans?.longitude || null,
            kategori: r.kategori_makanan?.nama_kategori || null,
            bahan_baku: Array.isArray(r.menu_bahan_baku) ? r.menu_bahan_baku.map(m => m.bahan_baku) : [],
            diet_claims: Array.isArray(r.menu_diet_claims) ? r.menu_diet_claims.map(m => m.diet_claims_list) : []
        };
    },

    // Get menu by slug with fallbacks
    getMenuBySlug: async (slug) => {
        // Try fetching menu by slug (only approved menus)
        try {
            const { data, error } = await supabase
                .from('menu_makanan')
                .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude,slug), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama,deskripsi,is_alergen)), menu_diet_claims(diet_claims_list(id,nama,deskripsi))')
                .eq('slug', slug)
                .eq('status_verifikasi', 'disetujui')
                .limit(1)
                .single();
            if (!error && data) {
                const r = data;
                return {
                    id: r.id,
                    restoran_id: r.restoran_id,
                    kategori_id: r.kategori_id,
                    nama_menu: r.nama_menu,
                    deskripsi: r.deskripsi,
                    harga: r.harga,
                        foto: r.foto || null,
                        foto_path: (function(){
                            const raw = r.foto_path || r.foto || null;
                            try {
                                if (!raw) return null;
                                if (/^https?:\/\//i.test(String(raw))) return String(raw).trim();
                                return buildPublicUrlFromStoredPath(raw) || null;
                            } catch(e) { return null; }
                        })(),
                        foto_storage_provider: (function(){
                            const v = (r.foto_path || r.foto || null);
                            try {
                                if (!v) return null;
                                if (/^https?:\/\//i.test(String(v))) {
                                    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                                    return SUPABASE_URL && String(v).includes(SUPABASE_URL) ? 'supabase' : 'external';
                                }
                                const pub = buildPublicUrlFromStoredPath(v);
                                return pub ? 'supabase' : null;
                            } catch (e) { return null; }
                        })(),
                    slug: r.slug,
                    status_verifikasi: r.status_verifikasi,
                    nama_restoran: r.restorans?.nama_restoran || null,
                    alamat: r.restorans?.alamat || null,
                    kategori: r.kategori_makanan?.nama_kategori || null,
                    kalori: r.kalori,
                    karbohidrat: r.karbohidrat,
                    kolesterol: r.kolesterol,
                    natrium: r.natrium,
                    protein: r.protein,
                    gula: r.gula,
                    lemak: r.lemak,
                    serat: r.serat,
                    lemak_jenuh: r.lemak_jenuh,
                    bahan_baku: Array.isArray(r.menu_bahan_baku) ? r.menu_bahan_baku.map(m => m.bahan_baku) : [],
                    diet_claims: Array.isArray(r.menu_diet_claims) ? r.menu_diet_claims.map(m => m.diet_claims_list) : []
                };
            }
        } catch (e) { /* continue to fallback */ }

        // fallback: normalized name -> try matching by transformed name
        const nameCandidate = String(slug).replace(/-/g, ' ');
        try {
            const { data: results } = await supabase
                .from('menu_makanan')
                .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude,slug), kategori_makanan(nama_kategori), menu_bahan_baku(bahan_baku(id,nama)), menu_diet_claims(diet_claims_list(id,nama))')
                .ilike('nama_menu', nameCandidate)
                .eq('status_verifikasi', 'disetujui')
                .limit(1);
            if (results && results.length) {
                const r = results[0];
                return {
                    id: r.id,
                    restoran_id: r.restoran_id,
                    kategori_id: r.kategori_id,
                    nama_menu: r.nama_menu,
                    deskripsi: r.deskripsi,
                    harga: r.harga,
                        foto: r.foto || null,
                        foto_path: (function(){
                            const raw = r.foto_path || r.foto || null;
                            try {
                                if (!raw) return null;
                                if (/^https?:\/\//i.test(String(raw))) return String(raw).trim();
                                return buildPublicUrlFromStoredPath(raw) || null;
                            } catch(e) { return null; }
                        })(),
                        foto_storage_provider: (function(){
                            const v = (r.foto_path || r.foto || null);
                            try {
                                if (!v) return null;
                                if (/^https?:\/\//i.test(String(v))) {
                                    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                                    return SUPABASE_URL && String(v).includes(SUPABASE_URL) ? 'supabase' : 'external';
                                }
                                const pub = buildPublicUrlFromStoredPath(v);
                                return pub ? 'supabase' : null;
                            } catch (e) { return null; }
                        })(),
                    slug: r.slug,
                    status_verifikasi: r.status_verifikasi,
                    nama_restoran: r.restorans?.nama_restoran || null,
                    alamat: r.restorans?.alamat || null,
                    kategori: r.kategori_makanan?.nama_kategori || null,
                    kalori: r.kalori,
                    karbohidrat: r.karbohidrat,
                    kolesterol: r.kolesterol,
                    natrium: r.natrium,
                    protein: r.protein,
                    gula: r.gula,
                    lemak: r.lemak,
                    serat: r.serat,
                    lemak_jenuh: r.lemak_jenuh,
                    bahan_baku: Array.isArray(r.menu_bahan_baku) ? r.menu_bahan_baku.map(m => m.bahan_baku) : [],
                    diet_claims: Array.isArray(r.menu_diet_claims) ? r.menu_diet_claims.map(m => m.diet_claims_list) : []
                };
            }
        } catch (e) { /* ignore */ }
        return null;
    }
};

// Find menus by diet claim key (e.g. 'low_calorie', 'high_fiber')
MenuModel.findByDietClaim = async (claimKey, limit = 12) => {
    if (!claimKey) return [];
    try {
        // New implementation: use diet_claims_list and pivot table menu_diet_claims
        const raw = String(claimKey).trim();
        // support multiple incoming key shapes: english_snake_case, slug, or human-readable
        const englishToIndo = {
            'low_calorie': 'Rendah Kalori',
            'low_sugar': 'Rendah Gula',
            'high_protein': 'Tinggi Protein',
            'high_fiber': 'Tinggi Serat',
            'balanced': 'Seimbang',
            'vegan': 'Vegetarian / Vegan',
            'low_saturated_fat': 'Rendah Lemak Jenuh',
            'kids_friendly': 'Kids Friendly',
            'gluten_free': 'Gluten Free',
            'organic': 'Organik'
        };

        const human = englishToIndo[raw] || raw.replace(/_/g, ' ');
        const slugCandidate = raw.replace(/\s+/g, '-').toLowerCase();
        const patterns = [`%${human}%`, `%${raw}%`, `%${raw.toLowerCase()}%`, `%${slugCandidate}%`];
        // find matching diet claim ids
        let claimIds = [];
        for (const p of patterns) {
            const { data: drows, error } = await supabase.from('diet_claims_list').select('id,nama').ilike('nama', p).limit(50);
            if (error) { console.warn('findByDietClaim diet_claims_list lookup error', error); continue; }
            if (drows && drows.length) claimIds.push(...drows.map(d => d.id));
        }
        // de-duplicate
        claimIds = Array.from(new Set(claimIds));
        if (!claimIds.length) return [];

        // find menu ids attached to these claims
        const { data: pivotRows, error: pivotErr } = await supabase.from('menu_diet_claims').select('menu_id').in('claim_id', claimIds);
        if (pivotErr) { console.error('findByDietClaim pivot fetch error', pivotErr); return []; }
        const menuIds = Array.from(new Set((pivotRows || []).map(r => r.menu_id))).slice(0, 200);
        if (!menuIds.length) return [];

        // fetch menus with relations
        const { data: menus, error: menusErr } = await supabase.from('menu_makanan')
            .select('id,nama_menu,deskripsi,harga,foto,kalori,protein,restorans(nama_restoran,slug),rating,reviews,slug,kategori_id,status_verifikasi,kategori_makanan(nama_kategori),menu_bahan_baku(bahan_baku(id,nama)),menu_diet_claims(diet_claims_list(id,nama))')
            .in('id', menuIds)
            .eq('status_verifikasi', 'disetujui')
            .order('rating', { ascending: false })
            .order('reviews', { ascending: false })
            .limit(limit);
        if (menusErr) { console.error('findByDietClaim menu fetch error', menusErr); return []; }
        return (menus || []).map(r => ({
            id: r.id,
            nama_menu: r.nama_menu,
            deskripsi: r.deskripsi,
            harga: r.harga,
            foto: r.foto || null,
            foto_path: (function(){
                const raw = r.foto_path || r.foto || null;
                try {
                    if (!raw) return null;
                    if (/^https?:\/\//i.test(String(raw))) return String(raw).trim();
                    return buildPublicUrlFromStoredPath(raw) || null;
                } catch(e) { return null; }
            })(),
            foto_storage_provider: (function(){
                const v = (r.foto_path || r.foto || null);
                try {
                    if (!v) return null;
                    if (/^https?:\/\//i.test(String(v))) {
                        const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                        return SUPABASE_URL && String(v).includes(SUPABASE_URL) ? 'supabase' : 'external';
                    }
                    const pub = buildPublicUrlFromStoredPath(v);
                    return pub ? 'supabase' : null;
                } catch (e) { return null; }
            })(),
                kalori: r.kalori,
                karbohidrat: r.karbohidrat,
                kolesterol: r.kolesterol,
                natrium: r.natrium,
            protein: r.protein,
            diet_claims: Array.isArray(r.menu_diet_claims) ? r.menu_diet_claims.map(m => m.diet_claims_list) : [],
            nama_restoran: r.restorans?.nama_restoran || null,
            restaurant_slug: r.restorans?.slug || null,
            rating: r.rating || 0,
            reviews: r.reviews || 0,
            slug: r.slug,
            kategori_id: r.kategori_id,
            kategori: r.kategori_makanan?.nama_kategori || null,
            status_verifikasi: r.status_verifikasi
        }));
    } catch (e) {
        console.error('findByDietClaim caught', e);
        return [];
    }
};

// Create new menu with unique slug (preserve behavior)
MenuModel.create = async (data) => {
    let baseSlug = slugify(data.nama_menu || 'menu');
    let slug = baseSlug;
    let suffix = 0;
    while (true) {
        const { data: exists, error } = await supabase.from('menu_makanan').select('id').eq('slug', slug).limit(1);
        if (error) { console.error('slug existence check error', error); break; }
        if (!exists || exists.length === 0) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
    }

    const payload = {
        restoran_id: data.restoran_id || null,
        kategori_id: data.kategori_id || null,
        nama_menu: data.nama_menu || null,
        deskripsi: data.deskripsi || null,
        metode_masak: data.metode_masak || null,
        kalori: typeof data.kalori !== 'undefined' && data.kalori !== null ? data.kalori : null,
        protein: typeof data.protein !== 'undefined' && data.protein !== null ? data.protein : null,
        gula: typeof data.gula !== 'undefined' && data.gula !== null ? data.gula : null,
        lemak: typeof data.lemak !== 'undefined' && data.lemak !== null ? data.lemak : null,
        serat: typeof data.serat !== 'undefined' && data.serat !== null ? data.serat : null,
        lemak_jenuh: typeof data.lemak_jenuh !== 'undefined' && data.lemak_jenuh !== null ? data.lemak_jenuh : null,
        karbohidrat: typeof data.karbohidrat !== 'undefined' && data.karbohidrat !== null ? data.karbohidrat : null,
        kolesterol: typeof data.kolesterol !== 'undefined' && data.kolesterol !== null ? data.kolesterol : null,
        natrium: typeof data.natrium !== 'undefined' && data.natrium !== null ? data.natrium : null,
        harga: data.harga || 0,
        foto: data.foto || null,
        foto_path: data.foto_path || null,
        foto_storage_provider: data.foto_storage_provider || null,
        status_verifikasi: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        slug
    };
    const { data: inserted, error: insertErr } = await supabase.from('menu_makanan').insert(payload).select('id').limit(1).single();
    if (insertErr) { console.error('create menu error', insertErr); throw insertErr; }
    const insertedId = inserted?.id || null;
    if (!insertedId) return null;
    const full = await MenuModel.getMenuDetailById(insertedId);
    try { const cache = require('../utils/cache'); await cache.del('featured_menus:10'); } catch (e) { }
    return full;
};

// Update an existing menu row and return expanded object
MenuModel.updateMenu = async (id, data) => {
    if (!id) throw new Error('Missing id');
    // Allowed fields to update
    const allowed = ['kategori_id','nama_menu','deskripsi','metode_masak','kalori','protein','gula','lemak','serat','lemak_jenuh','karbohidrat','kolesterol','natrium','harga','foto','foto_path','foto_storage_provider','status_verifikasi'];
    const payload = {};
    for (const k of allowed) {
        if (typeof data[k] !== 'undefined') payload[k] = data[k];
    }
    payload.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase.from('menu_makanan').update(payload).eq('id', id).select('id').limit(1).single();
    if (error) { console.error('updateMenu error', error); throw error; }
    try { const cache = require('../utils/cache'); await cache.del('featured_menus:10'); } catch (e) { }
    return MenuModel.getMenuDetailById(id);
};

MenuModel.findBySlug = async (slug) => {
    return MenuModel.getMenuBySlug(slug);
};

MenuModel.findById = async (id) => {
    const row = await MenuModel.getMenuDetail(id);
    return row;
};

MenuModel.createMenu = async (data) => {
    return MenuModel.create(data);
};

// Find menus by restaurant id with category and average rating
MenuModel.findByRestaurantId = async (restoranId) => {
    // We'll fetch menus, include kategori and compute average rating per-menu in JS
    const { data, error } = await supabase
        .from('menu_makanan')
        .select('id,nama_menu,slug,harga,foto,status_verifikasi,kalori,kategori_makanan(nama_kategori),ulasan(rating)')
        .eq('restoran_id', restoranId)
        .order('updated_at', { ascending: false });
    if (error) { console.error('findByRestaurantId error', error); return []; }
    return (data || []).map(r => {
        const ratings = (r.ulasan || []).map(u => Number(u.rating) || 0);
        const avg = ratings.length ? Math.round((ratings.reduce((a,b) => a+b,0)/ratings.length) * 100) / 100 : null;
        return {
            id: r.id,
            nama_menu: r.nama_menu,
            slug: r.slug,
            harga: r.harga,
                foto: r.foto || null,
                foto_path: (function(){
                    const raw = r.foto_path || r.foto || null;
                    try {
                        if (!raw) return null;
                        if (/^https?:\/\//i.test(String(raw))) return String(raw).trim();
                        return buildPublicUrlFromStoredPath(raw) || null;
                    } catch(e) { return null; }
                })(),
                foto_storage_provider: (function(){
                    const v = (r.foto_path || r.foto || null);
                    try {
                        if (!v) return null;
                        if (/^https?:\/\//i.test(String(v))) {
                            const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
                            return SUPABASE_URL && String(v).includes(SUPABASE_URL) ? 'supabase' : 'external';
                        }
                        const pub = buildPublicUrlFromStoredPath(v);
                        return pub ? 'supabase' : null;
                    } catch (e) { return null; }
                })(),
            status_verifikasi: r.status_verifikasi,
            kategori: r.kategori_makanan?.nama_kategori || null,
            kalori: r.kalori,
            rating: avg !== null ? Number(avg) : null
        };
    });
};

module.exports = MenuModel;

// Delete menu row (hard delete). Caller should ensure authorization.
MenuModel.deleteMenu = async (id) => {
    if (!id) throw new Error('Missing id');
    const { data, error } = await supabase.from('menu_makanan').delete().eq('id', id).select('id').limit(1).single();
    if (error) { console.error('deleteMenu error', error); throw error; }
    try { const cache = require('../utils/cache'); await cache.del('featured_menus:10'); } catch (e) { }
    return data;
};