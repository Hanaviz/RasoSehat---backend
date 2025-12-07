const supabase = require('../supabase/supabaseClient');

class RestaurantModel {
	static async createStep1({ nama_restoran, alamat, user_id }) {
		const payload = {
			user_id: user_id || null,
			nama_restoran: nama_restoran || null,
			alamat: alamat || null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		const { data, error } = await supabase.from('restorans').insert(payload).select('id').limit(1).single();
		if (error) { console.error('createStep1 error', error); throw error; }
		const id = data?.id || null;
		return this.findById(id);
	}

	static async updateStep2(id, fields) {
		const slugify = (text) => {
			if (!text) return null;
			return String(text).toLowerCase()
				.normalize('NFKD')
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9\-]/g, '')
				.replace(/\-+/g, '-')
				.replace(/^-+|-+$/g, '');
		};

		let finalSlug = fields.slug ? slugify(fields.slug) : null;
		if (finalSlug) {
			let candidate = finalSlug;
			let suffix = 0;
			while (true) {
				const { data: exists, error } = await supabase.from('restorans').select('id').eq('slug', candidate).neq('id', id).limit(1);
				if (error) { console.error('slug check error', error); break; }
				if (!exists || exists.length === 0) { finalSlug = candidate; break; }
				suffix += 1;
				candidate = `${finalSlug}-${suffix}`;
			}
		}

		// Build payload only with provided keys to avoid overwriting existing NOT NULL columns with null
		const updatePayload = {};
		if (Object.prototype.hasOwnProperty.call(fields, 'nama_restoran')) updatePayload.nama_restoran = fields.nama_restoran;
		if (Object.prototype.hasOwnProperty.call(fields, 'alamat')) updatePayload.alamat = fields.alamat;
		if (Object.prototype.hasOwnProperty.call(fields, 'deskripsi')) updatePayload.deskripsi = fields.deskripsi;
		if (Object.prototype.hasOwnProperty.call(fields, 'latitude')) updatePayload.latitude = fields.latitude;
		if (Object.prototype.hasOwnProperty.call(fields, 'longitude')) updatePayload.longitude = fields.longitude;
		if (Object.prototype.hasOwnProperty.call(fields, 'no_telepon')) updatePayload.no_telepon = fields.no_telepon;
		if (Object.prototype.hasOwnProperty.call(fields, 'jenis_usaha')) updatePayload.jenis_usaha = fields.jenis_usaha;
		if (Object.prototype.hasOwnProperty.call(fields, 'owner_name')) updatePayload.owner_name = fields.owner_name;
		if (Object.prototype.hasOwnProperty.call(fields, 'owner_email')) updatePayload.owner_email = fields.owner_email;
		if (Object.prototype.hasOwnProperty.call(fields, 'phone_admin')) updatePayload.phone_admin = fields.phone_admin;
		if (Object.prototype.hasOwnProperty.call(fields, 'operating_hours')) updatePayload.operating_hours = fields.operating_hours;
		if (Object.prototype.hasOwnProperty.call(fields, 'sales_channels')) updatePayload.sales_channels = fields.sales_channels;
		if (Object.prototype.hasOwnProperty.call(fields, 'social_media')) updatePayload.social_media = fields.social_media;
		if (Object.prototype.hasOwnProperty.call(fields, 'store_category')) updatePayload.store_category = fields.store_category;
		if (Object.prototype.hasOwnProperty.call(fields, 'commitment_checked')) updatePayload.commitment_checked = fields.commitment_checked ? true : false;
		if (Object.prototype.hasOwnProperty.call(fields, 'health_focus')) updatePayload.health_focus = fields.health_focus;
		if (Object.prototype.hasOwnProperty.call(fields, 'dominant_cooking_method')) updatePayload.dominant_cooking_method = fields.dominant_cooking_method;
		if (Object.prototype.hasOwnProperty.call(fields, 'dominant_fat')) updatePayload.dominant_fat = fields.dominant_fat;
		if (Object.prototype.hasOwnProperty.call(fields, 'maps_latlong')) updatePayload.maps_latlong = fields.maps_latlong;
		if (Object.prototype.hasOwnProperty.call(fields, 'slug')) updatePayload.slug = finalSlug || null;
		// always update updated_at
		updatePayload.updated_at = new Date().toISOString();

		const { data, error } = await supabase.from('restorans').update(updatePayload).eq('id', id).select('id');
		if (error) { console.error('updateStep2 error', error); throw error; }
		return this.findById(id);
	}

	static async updateStep3(id, { foto, foto_ktp, npwp, dokumen_usaha, documents_json }) {
		const payload = {
			foto: foto || null,
			foto_ktp: foto_ktp || null,
			npwp: npwp || null,
			dokumen_usaha: dokumen_usaha || null,
			documents_json: documents_json || null,
			updated_at: new Date().toISOString()
		};
		const { data, error } = await supabase.from('restorans').update(payload).eq('id', id).select('id');
		if (error) { console.error('updateStep3 error', error); throw error; }
		return this.findById(id);
	}

	static async submitFinal(id) {
		const { data, error } = await supabase.from('restorans').update({ status_verifikasi: 'pending', updated_at: new Date().toISOString() }).eq('id', id).select('id');
		if (error) { console.error('submitFinal error', error); throw error; }
		return this.findById(id);
	}

	static async findById(id) {
		if (!id) return null;
		const { data, error } = await supabase.from('restorans').select('*').eq('id', id).limit(1).single();
		if (error) { console.error('findById error', error); return null; }
		const row = data || null;
		if (row) {
			try { row.health_focus = row.health_focus ? (typeof row.health_focus === 'object' ? row.health_focus : JSON.parse(row.health_focus)) : []; } catch (e) { row.health_focus = []; }
			try { row.dominant_cooking_method = row.dominant_cooking_method ? (typeof row.dominant_cooking_method === 'object' ? row.dominant_cooking_method : JSON.parse(row.dominant_cooking_method)) : []; } catch (e) { row.dominant_cooking_method = []; }
			try { row.documents_json = row.documents_json ? (typeof row.documents_json === 'object' ? row.documents_json : JSON.parse(row.documents_json)) : { foto_ktp: [], npwp: [], dokumen_usaha: [] }; } catch (e) { row.documents_json = { foto_ktp: [], npwp: [], dokumen_usaha: [] }; }
		}
		return row;
	}

	static async findByUserId(user_id) {
		const { data, error } = await supabase.from('restorans').select('*').eq('user_id', user_id);
		if (error) { console.error('findByUserId error', error); throw error; }
		return data || [];
	}

	static async findAll() {
		const { data, error } = await supabase.from('restorans').select('*').order('created_at', { ascending: false });
		if (error) { console.error('findAll restorans error', error); throw error; }
		return data || [];
	}

	static async findBySlug(slug) {
		// Try slug column first
		try {
			const { data, error } = await supabase.from('restorans').select('*').eq('slug', slug).eq('status_verifikasi', 'disetujui').limit(1).single();
			if (!error && data) return data;
		} catch (e) { /* continue */ }

		// Fallback: try normalized name. Note: complex normalization using LOWER(REPLACE(...)) may not be available via REST filters.
		// TODO: If exact normalized matching is required, consider adding a computed column `normalized_slug` in DB and index it.
		const nameCandidate = String(slug).replace(/-/g, ' ');
		try {
			const { data: rows, error } = await supabase.from('restorans').select('*').ilike('nama_restoran', nameCandidate).eq('status_verifikasi', 'disetujui').limit(1);
			if (!error && rows && rows.length) return rows[0];
		} catch (e) { /* ignore */ }

		return null;
	}
}

module.exports = RestaurantModel;