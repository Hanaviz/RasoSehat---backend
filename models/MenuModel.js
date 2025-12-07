const supabase = require('../supabase/supabaseClient');

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
    let claims = [];
    try {
        claims = val ? (typeof val === 'object' ? val : JSON.parse(val)) : [];
    } catch (e) {
        try { claims = String(val).split(',').map(s => s.trim()).filter(Boolean); } catch (e2) { claims = []; }
    }
    return claims;
};

const MenuModel = {
    // Get featured menus (preserve shape: include restoran.nama_restoran, restoran.alamat)
    getFeaturedMenus: async (limit = 10) => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('id,nama_menu,deskripsi,harga,foto,kalori,protein,diet_claims,restorans(nama_restoran,alamat)')
            .eq('status_verifikasi', 'disetujui')
            .order('updated_at', { ascending: false })
            .limit(limit);
        if (error) { console.error('getFeaturedMenus error', error); return []; }
        return (data || []).map(r => ({
            id: r.id,
            nama_menu: r.nama_menu,
            deskripsi: r.deskripsi,
            harga: r.harga,
            foto: r.foto,
            kalori: r.kalori,
            protein: r.protein,
            diet_claims: safeParseClaims(r.diet_claims),
            nama_restoran: r.restorans?.nama_restoran || null,
            alamat: r.restorans?.alamat || null
        }));
    },

    // Search and filter
    searchAndFilter: async (searchQuery, categoryId, minRating, limit = 20) => {
        try {
            let q = supabase
                .from('menu_makanan')
                .select('id,nama_menu,deskripsi,harga,foto,kalori,gula,lemak,diet_claims,restorans(nama_restoran,alamat,latitude,longitude)')
                .eq('status_verifikasi', 'disetujui');

            if (searchQuery) {
                const term = `%${searchQuery}%`;
                q = q.or(`nama_menu.ilike.${term},deskripsi.ilike.${term}`);
            }
            if (categoryId) q = q.eq('kategori_id', categoryId);
            q = q.limit(limit).order('updated_at', { ascending: false });

            const { data, error } = await q;
            if (error) { console.error('searchAndFilter error', error); return []; }
            return (data || []).map(r => ({
                id: r.id,
                nama_menu: r.nama_menu,
                deskripsi: r.deskripsi,
                harga: r.harga,
                foto: r.foto,
                kalori: r.kalori,
                gula: r.gula,
                lemak: r.lemak,
                diet_claims: safeParseClaims(r.diet_claims),
                nama_restoran: r.restorans?.nama_restoran || null,
                alamat: r.restorans?.alamat || null,
                latitude: r.restorans?.latitude || null,
                longitude: r.restorans?.longitude || null
            }));
        } catch (e) {
            console.error('searchAndFilter caught', e);
            return [];
        }
    },

    // List all menus with category and restoran info
    findAll: async () => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('id,restoran_id,kategori_id,nama_menu,deskripsi,harga,foto,slug,status_verifikasi,diet_claims,kalori,protein,gula,lemak,serat,lemak_jenuh,kategori_makanan(nama_kategori),restorans(nama_restoran,alamat)')
            .order('updated_at', { ascending: false });
        if (error) { console.error('findAll error', error); return []; }
        return (data || []).map(r => ({
            id: r.id,
            restoran_id: r.restoran_id,
            kategori_id: r.kategori_id,
            nama_menu: r.nama_menu,
            deskripsi: r.deskripsi,
            harga: r.harga,
            foto: r.foto,
            slug: r.slug,
            status_verifikasi: r.status_verifikasi,
            diet_claims: safeParseClaims(r.diet_claims),
            kalori: r.kalori,
            protein: r.protein,
            gula: r.gula,
            lemak: r.lemak,
            serat: r.serat,
            lemak_jenuh: r.lemak_jenuh,
            nama_kategori: r.kategori_makanan?.nama_kategori || null,
            nama_restoran: r.restorans?.nama_restoran || null,
            alamat: r.restorans?.alamat || null
        }));
    },

    // List all approved menus
    findAllApproved: async () => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('id,restoran_id,kategori_id,nama_menu,deskripsi,harga,foto,slug,status_verifikasi,diet_claims,kalori,protein,gula,lemak,serat,lemak_jenuh,kategori_makanan(nama_kategori),restorans(nama_restoran,alamat)')
            .eq('status_verifikasi', 'disetujui')
            .order('updated_at', { ascending: false });
        if (error) { console.error('findAllApproved error', error); return []; }
        return (data || []).map(r => ({
            id: r.id,
            restoran_id: r.restoran_id,
            kategori_id: r.kategori_id,
            nama_menu: r.nama_menu,
            deskripsi: r.deskripsi,
            harga: r.harga,
            foto: r.foto,
            slug: r.slug,
            status_verifikasi: r.status_verifikasi,
            diet_claims: safeParseClaims(r.diet_claims),
            kalori: r.kalori,
            protein: r.protein,
            gula: r.gula,
            lemak: r.lemak,
            serat: r.serat,
            lemak_jenuh: r.lemak_jenuh,
            nama_kategori: r.kategori_makanan?.nama_kategori || null,
            nama_restoran: r.restorans?.nama_restoran || null,
            alamat: r.restorans?.alamat || null
        }));
    },

    // Detail menu (approved)
    getMenuDetail: async (id) => {
        const { data, error } = await supabase
            .from('menu_makanan')
            .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude)')
            .eq('id', id)
            .eq('status_verifikasi', 'disetujui')
            .limit(1)
            .single();
        if (error) { console.error('getMenuDetail error', error); return null; }
        const r = data;
        if (!r) return null;
        return { ...r, diet_claims: safeParseClaims(r.diet_claims), nama_restoran: r.restorans?.nama_restoran || null, alamat: r.restorans?.alamat || null, no_telepon: r.restorans?.no_telepon || null, latitude: r.restorans?.latitude || null, longitude: r.restorans?.longitude || null };
    },

    // Get menu by slug with fallbacks
    getMenuBySlug: async (slug) => {
        // try slug column
        try {
            const { data, error } = await supabase
                .from('menu_makanan')
                .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude)')
                .eq('slug', slug)
                .eq('status_verifikasi', 'disetujui')
                .limit(1)
                .single();
            if (!error && data) return { ...data, diet_claims: safeParseClaims(data.diet_claims) };
        } catch (e) { /* continue to fallback */ }

        // fallback: normalized name
        const nameCandidate = String(slug).replace(/-/g, ' ');
        try {
            const { data: normData, error: normErr } = await supabase
                .from('menu_makanan')
                .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude)')
                .filter("LOWER(REPLACE(nama_menu,' ','-'))", 'eq', nameCandidate.toLowerCase())
                .eq('status_verifikasi', 'disetujui')
                .limit(1);
            if (normErr) {
                // Some PostgREST installations may not accept complex filter; fall back to simple
            } else if (normData && normData.length) return { ...normData[0], diet_claims: safeParseClaims(normData[0].diet_claims) };
        } catch (e) { /* ignore */ }

        // final fallback: exact name
        try {
            const { data: exactData, error: exactErr } = await supabase
                .from('menu_makanan')
                .select('*, restorans(nama_restoran,alamat,no_telepon,latitude,longitude)')
                .ilike('nama_menu', nameCandidate)
                .eq('status_verifikasi', 'disetujui')
                .limit(1);
            if (exactErr) return null;
            return exactData && exactData.length ? { ...exactData[0], diet_claims: safeParseClaims(exactData[0].diet_claims) } : null;
        } catch (e) {
            return null;
        }
    }
};

// Find menus by diet claim key (e.g. 'low_calorie', 'high_fiber')
MenuModel.findByDietClaim = async (claimKey, limit = 12) => {
    if (!claimKey) return [];
    try {
        // Dual matching strategy with localized display-name mapping and quoted JSON-as-text matching.
        const tryCandidates = [];
        const raw = String(claimKey).trim();
        const slugifyCandidate = (txt) => txt.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]+/g, '').replace(/\-+/g, '-').replace(/^\-|\-$/g, '');
        const underscored = raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]+/g, '');
        const hyphen = slugifyCandidate(raw);
        // Base attempts: original key, hyphen, underscored
        tryCandidates.push({ type: 'raw', value: raw });
        if (hyphen && hyphen !== raw) tryCandidates.push({ type: 'hyphen', value: hyphen });
        if (underscored && underscored !== raw && underscored !== hyphen) tryCandidates.push({ type: 'underscore', value: underscored });

        // Map known canonical keys to localized/display names to increase match chance
        const claimDisplayMap = {
            'low_sugar': ['Rendah Gula', 'Rendah Gula'],
            'low_calorie': ['Rendah Kalori', 'Rendah Kalori'],
            'high_protein': ['Tinggi Protein', 'Tinggi Protein'],
            'high_fiber': ['Tinggi Serat', 'Tinggi Serat'],
            'balanced': ['Seimbang', 'Seimbang'],
            'vegan': ['Vegan', 'Vegan'],
            'low_saturated_fat': ['Rendah Lemak Jenuh', 'Rendah Lemak Jenuh'],
            'kids_friendly': ['Ramah Anak', 'Ramah Anak'],
            'gluten_free': ['Bebas Gluten', 'Bebas Gluten'],
            'organic': ['Organik', 'Organik']
        };
        const displayCandidates = claimDisplayMap[raw] || [];

        // Helper to run an ilike query and return normalized rows if any
        const runIlike = async (patternDesc, pattern) => {
            try {
                console.log(`[MenuModel.findByDietClaim] ilike attempt pattern='${patternDesc}' patternRaw='${pattern}' limit=${limit}`);
                const { data, error } = await supabase
                    .from('menu_makanan')
                    .select('id,nama_menu,deskripsi,harga,foto,kalori,protein,diet_claims,restorans(nama_restoran,slug),rating,reviews,slug,kategori_id,status_verifikasi')
                    .eq('status_verifikasi', 'disetujui')
                    .ilike('diet_claims', pattern)
                    .order('rating', { ascending: false })
                    .order('reviews', { ascending: false })
                    .limit(limit);
                if (error) {
                    console.warn(`[MenuModel.findByDietClaim] ilike query error for pattern '${pattern}':`, error.message || error);
                    return null;
                }
                if (data && data.length) {
                    const rows = (data || []).map(r => ({
                        id: r.id,
                        nama_menu: r.nama_menu,
                        deskripsi: r.deskripsi,
                        harga: r.harga,
                        foto: r.foto,
                        kalori: r.kalori,
                        protein: r.protein,
                        diet_claims: safeParseClaims(r.diet_claims),
                        nama_restoran: r.restorans?.nama_restoran || null,
                        restaurant_slug: r.restorans?.slug || null,
                        rating: r.rating || 0,
                        reviews: r.reviews || 0,
                        slug: r.slug,
                        kategori_id: r.kategori_id,
                        status_verifikasi: r.status_verifikasi
                    }));
                    console.log(`[MenuModel.findByDietClaim] ilike matched pattern='${patternDesc}' -> ${rows.length} rows`);
                    return rows;
                }
                return null;
            } catch (e) {
                console.error('[MenuModel.findByDietClaim] ilike attempt threw', e && e.message ? e.message : e);
                return null;
            }
        };

        // First try base candidates (raw/hyphen/underscore)
        for (const cand of tryCandidates) {
            const pattern = `%${cand.value}%`;
            const res = await runIlike(cand.type + ':' + cand.value, pattern);
            if (res && res.length) return res;
            console.log(`[MenuModel.findByDietClaim] no rows for attempt '${cand.value}'`);
        }

        // Next try display-name candidates, including quoted patterns to match JSON-as-text
        for (const disp of displayCandidates) {
            // unquoted
            const res1 = await runIlike('display_unquoted:' + disp, `%${disp}%`);
            if (res1 && res1.length) return res1;
            // quoted (to match JSON text like ["Rendah Gula"])
            const quotedPattern = `%"${disp}"%`;
            const res2 = await runIlike('display_quoted:' + disp, quotedPattern);
            if (res2 && res2.length) return res2;
            console.log(`[MenuModel.findByDietClaim] no rows for display attempt '${disp}'`);
        }

        console.log(`[MenuModel.findByDietClaim] no matches for '${claimKey}'`);
        return [];
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
        bahan_baku: data.bahan_baku || null,
        metode_masak: data.metode_masak || null,
        diet_claims: data.diet_claims || '[]',
        kalori: data.kalori || 0,
        protein: data.protein || 0,
        gula: data.gula || 0,
        lemak: data.lemak || 0,
        serat: data.serat || 0,
        lemak_jenuh: data.lemak_jenuh || 0,
        harga: data.harga || 0,
        foto: data.foto || null,
        status_verifikasi: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        slug
    };
    const { data: inserted, error: insertErr } = await supabase.from('menu_makanan').insert(payload).select('id').limit(1).single();
    if (insertErr) { console.error('create menu error', insertErr); throw insertErr; }
    const insertedId = inserted?.id || null;
    if (!insertedId) return null;
    const { data: row, error: rowErr } = await supabase.from('menu_makanan').select('*, restorans(nama_restoran,alamat)').eq('id', insertedId).limit(1).single();
    if (rowErr) { console.error('fetch inserted menu error', rowErr); return null; }
    return { ...row, diet_claims: safeParseClaims(row.diet_claims) };
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
            foto: r.foto,
            status_verifikasi: r.status_verifikasi,
            kategori: r.kategori_makanan?.nama_kategori || null,
            kalori: r.kalori,
            rating: avg !== null ? Number(avg) : null
        };
    });
};

module.exports = MenuModel;