const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------------------------------
   Request Logger (development only)
-------------------------------------------- */
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`);
    next();
  });
}

/* -------------------------------------------
   CORS CONFIG — FULLY FIXED
-------------------------------------------- */

// Domain frontend utama kamu (WAJIB ADA)
const MAIN_FRONTEND = "https://raso-sehat.vercel.app";

// Default allowed origins
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  MAIN_FRONTEND,
]);

// Tambahkan juga domain dari ENV (opsional)
const envCandidates = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.DEPLOYED_FRONTEND_URL,
  process.env.NEXT_PUBLIC_FRONTEND_URL,
  process.env.RAILWAY_STATIC_URL,
  process.env.FRONTEND_DOMAIN,
];

envCandidates.forEach((u) => {
  if (u && typeof u === "string") allowedOrigins.add(u);
});

// Convert ke array untuk CORS
const allowedOriginsArray = Array.from(allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // mobile / server-to-server

      if (allowedOriginsArray.includes(origin)) {
        return callback(null, true);
      }

      console.warn("[CORS BLOCKED]:", origin);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

if (process.env.NODE_ENV !== "production") {
  console.log("[CORS] Allowed origins:", allowedOriginsArray);
}

app.use(bodyParser.json());

/* -------------------------------------------
   STATIC FILES - PENTING UNTUK AVATAR!
-------------------------------------------- */
const path = require("path");

// quick existence checker for uploads - logs missing files (helps debug 404s in production)
const fs = require('fs');

// Serve static files dari folder uploads
// HARUS sebelum route definitions agar file bisa diakses
app.use(
  "/uploads",
  // middleware to log missing files for easier debugging
  (req, res, next) => {
    try {
      const p = path.join(__dirname, 'uploads', req.path);
      if (!fs.existsSync(p)) {
        console.warn('[UPLOADS][MISSING]', p, 'requested from', req.get('referer') || req.get('host') || req.ip);
      }
    } catch (e) { /* ignore */ }
    next();
  },
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d", // Cache untuk 1 hari
    etag: true,
  })
);

console.log("[STATIC] Serving uploads from:", path.join(__dirname, "uploads"));

/* -------------------------------------------
   ROUTES
-------------------------------------------- */

const categoryRoutes = require("./routes/categoryRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const menuRoutes = require("./routes/menuRoutes");
const searchRoutes = require("./routes/searchRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const { resizeAndCache } = require("./utils/imageResizer");

/* -------------------------------------------
   API ROUTES
-------------------------------------------- */

app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/ulasan", reviewRoutes);

// My-store route
const { verifyToken } = require("./middleware/authmiddleware");
const RestaurantController = require("./controllers/RestaurantController");

app.get("/api/my-store", verifyToken, RestaurantController.getMyStore);

/* -------------------------------------------
   IMAGE SERVING + RESIZING
-------------------------------------------- */

app.get("/uploads/menu/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const width = req.query.w ? Number(req.query.w) : null;
    const uploadsDir = path.join(__dirname, "uploads", "menu");
    const srcPath = path.join(uploadsDir, filename);

    if (!fs.existsSync(srcPath)) return res.status(404).send("Not found");

    if (!width) return res.sendFile(srcPath);

    const cacheDir = path.join(uploadsDir, "cache");
    const cachedName = `${width}-${filename}`;
    const cachedPath = path.join(cacheDir, cachedName);

    if (fs.existsSync(cachedPath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000");
      return res.sendFile(cachedPath);
    }

    await resizeAndCache(srcPath, cachedPath, width, 82);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return res.sendFile(cachedPath);
  } catch (err) {
    console.error("[Image Resize Error]", err.message || err);
    return res.status(500).send("Internal server error");
  }
});

/* -------------------------------------------
   HOME
-------------------------------------------- */

app.get("/", (req, res) => {
  res.send("RasoSehat Backend API is running!");
});

/* -------------------------------------------
   ERROR HANDLER
-------------------------------------------- */
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

/* -------------------------------------------
   START SERVER
-------------------------------------------- */
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Static files available at http://localhost:${PORT}/uploads/`);
  });
}

module.exports = app;
