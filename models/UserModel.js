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
    create: async (name, email, password_hash, role = 'pembeli') => {
        const query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        const [result] = await db.execute(query, [name, email, password_hash, role]);
        return result.insertId;
    }
};

module.exports = UserModel;