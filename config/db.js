// RasoSehat-Backend/config/db.js

const mysql = require('mysql2/promise');
require('dotenv').config(); // Pastikan variabel .env dimuat

// Membuat Pool Koneksi
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tes Koneksi
pool.getConnection()
    .then(connection => {
        console.log('✅ MySQL Database Connected successfully to rasosehat_db!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('The server will continue starting, but DB queries will fail until the connection is available.');
    });

module.exports = pool;