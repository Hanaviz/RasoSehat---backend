const DEFAULT_TTL = 300; // seconds (5 minutes)
let redisClient = null;
let usingRedis = false;
if (process.env.REDIS_URL) {
  try {
    const redis = require('redis');
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(() => {});
    usingRedis = true;
  } catch (e) {
    console.warn('Redis not available, falling back to in-memory cache', e && e.message ? e.message : e);
    usingRedis = false;
  }
}

const memoryCache = new Map();

function _now() { return Math.floor(Date.now() / 1000); }

async function get(key) {
  if (usingRedis && redisClient) {
    try {
      const v = await redisClient.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiry <= _now()) { memoryCache.delete(key); return null; }
  return entry.value;
}

async function set(key, value, ttl = DEFAULT_TTL) {
  if (usingRedis && redisClient) {
    try { await redisClient.set(key, JSON.stringify(value), { EX: ttl }); return true; } catch (e) { /* fallthrough */ }
  }
  memoryCache.set(key, { value, expiry: _now() + ttl });
  return true;
}

async function del(key) {
  if (usingRedis && redisClient) {
    try { await redisClient.del(key); return true; } catch (e) { /* fallthrough */ }
  }
  memoryCache.delete(key);
  return true;
}

module.exports = { get, set, del, usingRedis };
/**
 * Simple cache helper: use Redis if REDIS_URL present, otherwise in-memory Map with TTL.
 */
let createClient = null;
try {
  const redisMod = require('redis');
  if (redisMod && typeof redisMod.createClient === 'function') createClient = redisMod.createClient;
} catch (e) {
  // redis not installed or cannot be required; we'll fall back to in-memory cache
  createClient = null;
}

let client = null;
const useRedis = Boolean((process.env.REDIS_URL || process.env.REDIS_HOST) && createClient);

if (useRedis) {
  try {
    const redisUrl = process.env.REDIS_URL || null;
    client = createClient(redisUrl ? { url: redisUrl } : { socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379) } });
    client.on('error', (err) => { console.warn('Redis client error', err && err.message); });
    // connect may be async; handle errors gracefully
    (async () => {
      try { await client.connect(); } catch (err) { console.warn('Redis connect failed', err && err.message); client = null; }
    })();
  } catch (e) {
    console.warn('Failed to initialize Redis client', e && e.message);
    client = null;
  }
}

// In-memory fallback
const store = new Map();

function setInMemory(key, value, ttlSec) {
  const expiresAt = Date.now() + (ttlSec || 30) * 1000;
  store.set(key, { value, expiresAt });
}

function getInMemory(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

module.exports = {
  async get(key) {
    if (client) {
      try {
        const v = await client.get(key);
        return v;
      } catch (e) {
        console.warn('Redis get failed', e && e.message);
        return getInMemory(key);
      }
    }
    return getInMemory(key);
  },
  async set(key, value, ttlSec = 30) {
    if (client) {
      try {
        if (typeof value !== 'string') value = JSON.stringify(value);
        if (ttlSec) await client.setEx(key, ttlSec, value);
        else await client.set(key, value);
        return true;
      } catch (e) {
        console.warn('Redis set failed', e && e.message);
        setInMemory(key, typeof value === 'string' ? value : JSON.stringify(value), ttlSec);
        return false;
      }
    }
    setInMemory(key, typeof value === 'string' ? value : JSON.stringify(value), ttlSec);
    return true;
  }
};
