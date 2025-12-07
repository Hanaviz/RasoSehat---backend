const supabase = require('../supabase/supabaseClient');

class ReviewModel {
  // Tambah ulasan baru
  static async create({ user_id, menu_id, rating, komentar }) {
    const payload = {
      user_id,
      menu_id,
      rating,
      komentar: komentar || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('ulasan').insert(payload).select('id').limit(1).single();
    if (error) {
      console.error('Supabase create review error', error);
      throw error;
    }
    return data?.id ?? null;
  }

  // Ambil ulasan berdasarkan menu_id, sertakan nama user bila relasi tersedia
  static async findByMenuId(menu_id) {
    try {
      // Try to select related user name if foreign key relationship exists
      const { data, error } = await supabase
        .from('ulasan')
        .select('rating, komentar, created_at, users(name)')
        .eq('menu_id', menu_id)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: if relational select fails, just select reviews
        console.error('Supabase select review with user relation failed, fallback to plain select', error.message || error);
        const { data: simpleData, error: simpleErr } = await supabase
          .from('ulasan')
          .select('user_id, rating, komentar, created_at')
          .eq('menu_id', menu_id)
          .order('created_at', { ascending: false });
        if (simpleErr) {
          console.error('Supabase fallback select reviews failed', simpleErr);
          return [];
        }
        // Enrich with user names
        const userIds = Array.from(new Set(simpleData.map(r => r.user_id)));
        const { data: usersData } = await supabase.from('users').select('id,name').in('id', userIds);
        const usersById = (usersData || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        return simpleData.map(r => ({ name: usersById[r.user_id]?.name || null, rating: r.rating, komentar: r.komentar, created_at: r.created_at }));
      }

      // Map relational result to legacy shape
      return (data || []).map(item => ({ name: item.users?.name || null, rating: item.rating, komentar: item.komentar, created_at: item.created_at }));
    } catch (e) {
      console.error('findByMenuId error', e);
      return [];
    }
  }

  // Hitung rata-rata rating dan jumlah ulasan untuk menu
  static async getStats(menu_id) {
    try {
      // Fetch ratings and count (may be large for popular items; acceptable for now)
      const { data, error, count } = await supabase
        .from('ulasan')
        .select('rating', { count: 'exact' })
        .eq('menu_id', menu_id);
      if (error) {
        console.error('Supabase getStats error', error);
        return { average_rating: 0, total_reviews: 0 };
      }
      const ratings = (data || []).map(r => Number(r.rating) || 0);
      const total = count ?? ratings.length;
      const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return { average_rating: parseFloat(average.toFixed(2)) || 0, total_reviews: total || 0 };
    } catch (e) {
      console.error('getStats caught error', e);
      return { average_rating: 0, total_reviews: 0 };
    }
  }

  // Update rating dan jumlah ulasan pada tabel menu_makanan
  static async updateMenuRating(menu_id) {
    try {
      const stats = await this.getStats(menu_id);
      const { data, error } = await supabase.from('menu_makanan').update({ rating: stats.average_rating, reviews: stats.total_reviews, updated_at: new Date().toISOString() }).eq('id', menu_id).select('id');
      if (error) {
        console.error('Supabase updateMenuRating error', error);
        return false;
      }
      return Array.isArray(data) ? data.length > 0 : !!data;
    } catch (e) {
      console.error('updateMenuRating caught error', e);
      return false;
    }
  }
}

module.exports = ReviewModel;