const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); 
require('./config/db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Simple request logger for development to help diagnose 404s and routing issues
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        try {
            console.log(`[REQ] ${req.method} ${req.originalUrl} - body: ${JSON.stringify(req.body || {})}`);
        } catch (e) {
            console.log(`[REQ] ${req.method} ${req.originalUrl}`);
        }
        next();
    });
}

// Enable CORS for local development. Accept requests from localhost on any port
// or fallback to the value in env if provided. This avoids CORS failures when
// Vite uses a different port (5173/5174/etc.). In production this should be
// tightened to the proper origin or handled by a reverse proxy.
// Build allowed origins list (starts with common local dev hosts)
const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
]);

// Allow configuration via environment variables (useful for Vercel, Railway, etc.)
const envFrontendCandidates = [
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_FRONTEND_URL,
    process.env.DEPLOYED_FRONTEND_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
];
envFrontendCandidates.forEach((u) => {
    if (u && typeof u === 'string') allowedOrigins.add(u);
});

// If a Vite/Vercel style frontend domain is present in .env (common), include it
if (process.env.FRONTEND_DOMAIN) allowedOrigins.add(process.env.FRONTEND_DOMAIN);

// Convert to array for the CORS middleware
const allowedOriginsArray = Array.from(allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // allow server-to-server / mobile apps
        if (allowedOriginsArray.includes(origin)) return callback(null, true);
        // For debugging in non-production, print the rejected origin
        if (process.env.NODE_ENV !== 'production') console.warn('[CORS] Rejected origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

if (process.env.NODE_ENV !== 'production') {
    console.log('[CORS] allowed origins:', allowedOriginsArray);
}
 
app.use(bodyParser.json());

const categoryRoutes = require('./routes/categoryRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const menuRoutes = require('./routes/menuRoutes');
const searchRoutes = require('./routes/searchRoutes');
const path = require('path');
const restaurantRoutes = require('./routes/restaurantRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const fs = require('fs');
const { resizeAndCache } = require('./utils/imageResizer');

app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/menus', menuRoutes); 
app.use('/api/search', searchRoutes);

// Serve uploaded files with optional on-demand resizing for menu images
// Example: GET /uploads/menu/12345.jpg?w=800
app.get('/uploads/menu/:filename', async (req, res, next) => {
    try {
        const filename = req.params.filename;
        const width = req.query.w ? Number(req.query.w) : null;
        const uploadsDir = path.join(__dirname, 'uploads', 'menu');
        const srcPath = path.join(uploadsDir, filename);

        if (!fs.existsSync(srcPath)) return res.status(404).send('Not found');

        if (!width) {
            // No resizing requested — stream original file
            return res.sendFile(srcPath);
        }

        const cacheDir = path.join(uploadsDir, 'cache');
        const cachedName = `${width}-${filename}`;
        const cachedPath = path.join(cacheDir, cachedName);

        if (fs.existsSync(cachedPath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.sendFile(cachedPath);
        }

        // Create resized version and serve it
        try {
            await resizeAndCache(srcPath, cachedPath, width, 82);
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.sendFile(cachedPath);
        } catch (err) {
            console.error('[image resize] failed', err && err.message ? err.message : err);
            // fallback to original
            return res.sendFile(srcPath);
        }
    } catch (err) {
        console.error('[uploads middleware] error', err && err.message ? err.message : err);
        return res.status(500).send('Internal server error');
    }
});

// Serve other uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Mount restaurants API
app.use('/api/restaurants', restaurantRoutes);
const { verifyToken } = require('./middleware/authmiddleware');
const RestaurantController = require('./controllers/RestaurantController');

// My-store quick endpoint: returns restaurant for logged-in user + menus and stats
app.get('/api/my-store', verifyToken, RestaurantController.getMyStore);
app.use('/api/ulasan', reviewRoutes);

app.get('/', (req, res) => {
    res.send('RasoSehat Backend API is running!');
});

// Error handler (must be last middleware)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Only start listening when not running tests. This allows test suites to import
// the Express `app` without binding the server to a port (supertest will use
// the app directly). When running `NODE_ENV=test` we skip listening.
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;