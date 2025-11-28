// RasoSehat-Backend/models/UserModel.js

const db = require('../config/db.js'); // Koneksi DB yang sudah teruji
const bcrypt = require('bcrypt');

const UserModel = {
    // Fungsi 1: Mencari User berdasarkan Email
    findByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await db.execute(query, [email]);
        return rows[0]; // Mengembalikan objek user
    },

    // Fungsi 2: Membuat User Baru (Register)
    create: async (name, email, password_hash, role = 'pembeli', extra = {}) => {
        // Build dynamic insert to allow optional columns (e.g., birth_date, gender, phone, avatar)
        const baseCols = ['name', 'email', 'password', 'role'];
        const baseVals = [name, email, password_hash, role];
        const extraKeys = Object.keys(extra || {}).filter(k => extra[k] !== undefined && extra[k] !== null);
        const cols = baseCols.concat(extraKeys);
        const placeholders = cols.map(_ => '?').join(', ');
        const query = `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders})`;
        const values = baseVals.concat(extraKeys.map(k => extra[k]));
        const [result] = await db.execute(query, values);
        return result.insertId;
    }
    ,
    // Fungsi 3: Mencari User berdasarkan ID
    findById: async (id) => {
        const query = 'SELECT id, name, email, role, birth_date, gender, phone, avatar FROM users WHERE id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows[0];
    },

    // Fungsi 4: Update profil user (update hanya fields yang diberikan)
    updateById: async (id, fields) => {
        const keys = Object.keys(fields);
        if (!keys.length) return 0;
        const sets = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => fields[k]);
        const query = `UPDATE users SET ${sets} WHERE id = ?`;
        const [result] = await db.execute(query, [...values, id]);
        return result.affectedRows;
    },

    // Fungsi 5: Set avatar path/url
    setAvatar: async (id, avatarUrl) => {
        const query = 'UPDATE users SET avatar = ? WHERE id = ?';
        const [result] = await db.execute(query, [avatarUrl, id]);
        return result.affectedRows;
    }
};

module.exports = UserModel;