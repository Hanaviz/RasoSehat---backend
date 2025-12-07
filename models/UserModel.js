// RasoSehat-Backend/models/UserModel.js (Supabase-backed)

const supabase = require('../supabase/supabaseClient');
const bcrypt = require('bcrypt');

const UserModel = {
    // Find user by email
    findByEmail: async (email) => {
        if (!email) return null;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            // PGRST116: no rows found — treat as null
            console.error('Supabase findByEmail error', error);
        }
        return data || null;
    },

    // Create a new user record
    create: async (name, email, password_hash, role = 'pembeli', extra = {}) => {
        const payload = {
            name,
            email,
            password: password_hash,
            role,
            ...extra,
        };
        // If user already exists by email, return existing id (avoid duplicate key errors)
        try {
            const { data: existing } = await supabase.from('users').select('id').eq('email', email).limit(1);
            if (existing && existing.length) return existing[0].id;
        } catch (e) {
            // ignore and continue to insert
        }

        try {
            const { data, error } = await supabase.from('users').insert(payload).select('id');
            if (error) throw error;
            return data && data[0] ? data[0].id : null;
        } catch (error) {
            // As a last resort, try to return existing user by email
            try {
                const { data: existing2 } = await supabase.from('users').select('id').eq('email', email).limit(1);
                if (existing2 && existing2.length) return existing2[0].id;
            } catch (e) { /* fallthrough */ }
            console.error('Supabase create user error', error);
            throw error;
        }
    },

    // Find by id with normalized fields
    findById: async (id) => {
        if (!id) return null;
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, role, birth_date, gender, phone, avatar, created_at')
            .eq('id', id)
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('Supabase findById error', error);
        }
        return data || null;
    },

    // Update by id — returns number of updated rows (1 on success)
    updateById: async (id, fields) => {
        if (!id) return 0;
        if (!fields || Object.keys(fields).length === 0) return 0;
        const { data, error } = await supabase.from('users').update(fields).eq('id', id).select('id');
        if (error) {
            console.error('Supabase updateById error', error);
            throw error;
        }
        return Array.isArray(data) ? data.length : (data ? 1 : 0);
    },

    // Set avatar field
    setAvatar: async (id, avatarUrl) => {
        if (!id) return 0;
        const { data, error } = await supabase.from('users').update({ avatar: avatarUrl }).eq('id', id).select('id');
        if (error) {
            console.error('Supabase setAvatar error', error);
            throw error;
        }
        return Array.isArray(data) ? data.length : (data ? 1 : 0);
    }
};

module.exports = UserModel;