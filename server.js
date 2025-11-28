const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); 
require('./config/db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for local development. Accept requests from localhost on any port
// or fallback to the value in env if provided. This avoids CORS failures when
// Vite uses a different port (5173/5174/etc.). In production this should be
// tightened to the proper origin or handled by a reverse proxy.
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow server-to-server / curl requests
        try {
            const url = new URL(origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
        } catch (e) {
            // ignore parse errors
        }
        // Allow explicitly configured origin via env var if set
        if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    }
};
app.use(cors(corsOptions)); 
app.use(bodyParser.json());

const categoryRoutes = require('./routes/categoryRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const menuRoutes = require('./routes/menuRoutes');
const path = require('path');
const restaurantRoutes = require('./routes/restaurantRoutes');

app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/menus', menuRoutes); 
// Serve uploaded files (restaurant uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Mount restaurants API
app.use('/api/restaurants', restaurantRoutes);

app.get('/', (req, res) => {
    res.send('RasoSehat Backend API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});