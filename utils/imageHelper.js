const supabase = require('../supabase/supabaseClient');
const path = require('path');

const BUCKET = process.env.SUPABASE_PUBLIC_IMAGES_BUCKET || 'public-images';

function normalizePath(p) {
  if (!p) return null;
  return String(p).replace(/^\//, '');
}

async function getPublicImageUrl(p, provider) {
  if (!p) return null;
  // If already absolute URL, return as-is
  if (/^https?:\/\//i.test(p)) return p;

  // If provider explicitly supabase, construct/get public URL
  if (provider === 'supabase' || provider === 'SUPABASE' || (p && String(p).includes('storage.googleapis.com'))) {
    const storagePath = normalizePath(p);
    try {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      if (data && (data.publicUrl || data.public_url)) return data.publicUrl || data.public_url;
    } catch (e) {
      // fallback to constructed URL (deterministic)
      try {
        const supaUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
        const encodedPath = storagePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
        return `${supaUrl}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
      } catch (ee) { return null; }
    }
  }

  // Otherwise treat as storage path in default bucket
  const storagePath = normalizePath(p);
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (data && (data.publicUrl || data.public_url)) return data.publicUrl || data.public_url;
  } catch (e) { /* ignore */ }

  // Last resort: return null to avoid exposing local /uploads paths
  return null;
}

async function uploadBufferToSupabase(buffer, destPath, contentType) {
  if (!buffer || !destPath) throw new Error('Missing buffer or destPath');
  const storagePath = normalizePath(destPath);
  const options = { contentType, upsert: true };
  const { data, error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, options);
  if (error) throw error;
  // Return public URL
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return (publicData && (publicData.publicUrl || publicData.public_url)) ? (publicData.publicUrl || publicData.public_url) : null;
}

module.exports = { getPublicImageUrl, uploadBufferToSupabase };
