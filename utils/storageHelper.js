const supabase = require('../supabase/supabaseClient');
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const DEFAULT_BUCKET = process.env.SUPABASE_MENU_BUCKET || process.env.SUPABASE_UPLOAD_BUCKET || 'uploads';

function normalizeStoredPath(p) {
  if (!p) return null;
  let s = String(p).trim();
  // remove leading /uploads/ or / or uploads/
  s = s.replace(/^\/*uploads\/*/i, '');
  s = s.replace(/^\//, '');
  return s;
}

function buildPublicUrlFromStoredPath(storedPath, bucket = DEFAULT_BUCKET) {
  if (!storedPath) return null;
  const s = String(storedPath).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const key = normalizeStoredPath(s);
  if (!key) return null;
  if (!SUPABASE_URL) return null;
  // Construct the Supabase public URL for public buckets
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(key)}`;
}

async function uploadFileToBucket(localPath, destPath, bucket = DEFAULT_BUCKET, opts = {}) {
  if (!localPath || !fs.existsSync(localPath)) throw new Error('Local file not found: ' + localPath);
  const buffer = fs.readFileSync(localPath);
  // destPath should be a path inside the bucket (no leading /)
  const key = String(destPath).replace(/^\//, '');
  const { data, error } = await supabase.storage.from(bucket).upload(key, buffer, { upsert: true, contentType: opts.contentType || undefined });
  if (error) throw error;
  // Build public URL deterministically without an extra network call
  const publicUrl = buildPublicUrlFromStoredPath(key, bucket);
  return publicUrl;
}

module.exports = {
  buildPublicUrlFromStoredPath,
  uploadFileToBucket,
  DEFAULT_BUCKET
};
