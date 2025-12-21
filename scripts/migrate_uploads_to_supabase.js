#!/usr/bin/env node
/**
 * Safe migration script: move local /uploads files to Supabase Storage
 * Usage:
 *   node migrate_uploads_to_supabase.js --dry-run
 *   node migrate_uploads_to_supabase.js --null-missing
 *
 * Behavior:
 * - Scans `menu_makanan` and `restorans` for legacy local paths (/uploads/...)
 * - If local file exists on disk, uploads to Supabase public bucket and updates foto_path + foto_storage_provider
 * - If local file is missing and `--null-missing` provided, clears legacy foto/foto_path to avoid 404s
 * - If `--dry-run` provided, only logs actions
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const supabase = require('../supabase/supabaseClient');
const { uploadBufferToSupabase } = require('../utils/imageHelper');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const NULL_MISSING = args.includes('--null-missing');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  if (i >= 0 && args[i+1]) return Number(args[i+1]) || null;
  return null;
})();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function isLocalUpload(p) {
  if (!p) return false;
  return String(p).startsWith('/uploads') || String(p).startsWith('uploads/') || String(p).includes('/uploads/');
}

async function processMenus() {
  console.log('\n[menus] scanning menu_makanan for legacy uploads...');
  try {
    // Try to select rows that likely reference uploads or have null foto_path
    let query = supabase.from('menu_makanan').select('id,restoran_id,foto,foto_path,foto_storage_provider').order('id', { ascending: false });
    if (LIMIT) query = query.limit(LIMIT);
    const { data: rows, error } = await query;
    if (error) throw error;
    for (const r of rows || []) {
      const id = r.id;
      const rawFotoPath = r.foto_path || r.foto || null;
      const provider = r.foto_storage_provider || null;
      if (!rawFotoPath) {
        // nothing to do
        continue;
      }
      if (!isLocalUpload(rawFotoPath)) {
        // already a public URL or unknown shape; skip
        continue;
      }

      // Determine local file path
      // normalize patterns like /uploads/menu/xxx or uploads/menu/xxx or menu/xxx
      let rel = String(rawFotoPath).replace(/^\//, '');
      if (rel.startsWith('uploads/')) rel = rel.replace(/^uploads\//, '');
      const localPath = path.join(UPLOADS_DIR, rel);

      if (fs.existsSync(localPath)) {
        console.log(`[menus] will upload local file for menu.id=${id} -> ${localPath}`);
        if (!DRY) {
          const buffer = fs.readFileSync(localPath);
          const filename = path.basename(localPath);
          const dest = `menu/${r.restoran_id || 'unknown'}/${Date.now()}-${filename}`;
          try {
            const publicUrl = await uploadBufferToSupabase(buffer, dest, null);
            if (publicUrl) {
              await supabase.from('menu_makanan').update({ foto_path: publicUrl, foto_storage_provider: 'supabase' }).eq('id', id);
              console.log(`[menus] updated menu.id=${id} foto_path -> ${publicUrl}`);
            }
          } catch (e) {
            console.error(`[menus] upload failed for menu.id=${id}`, e.message || e);
          }
        }
      } else {
        console.warn(`[menus] local file missing for menu.id=${id}: ${localPath}`);
        if (!DRY && NULL_MISSING) {
          try {
            await supabase.from('menu_makanan').update({ foto: null, foto_path: null, foto_storage_provider: null }).eq('id', id);
            console.log(`[menus] cleared foto fields for menu.id=${id}`);
          } catch (e) { console.error('[menus] failed to clear fields', e.message || e); }
        }
      }
    }
  } catch (e) {
    console.error('[menus] error', e.message || e);
  }
}

async function processRestorans() {
  console.log('\n[restorans] scanning restorans for legacy uploads...');
  try {
    let query = supabase.from('restorans').select('id,foto,foto_path,foto_storage_provider,documents_json').order('id', { ascending: false });
    if (LIMIT) query = query.limit(LIMIT);
    const { data: rows, error } = await query;
    if (error) throw error;
    for (const r of rows || []) {
      const id = r.id;
      // check documents_json.profile first
      let docs = null;
      try { docs = r.documents_json ? (typeof r.documents_json === 'object' ? r.documents_json : JSON.parse(r.documents_json)) : null; } catch (e) { docs = null; }
      const candidates = [];
      if (docs && docs.profile) candidates.push({ key: 'documents_json.profile', val: docs.profile });
      if (r.foto_path) candidates.push({ key: 'foto_path', val: r.foto_path });
      if (r.foto) candidates.push({ key: 'foto', val: r.foto });

      let updatedDocs = docs ? { ...docs } : null;
      let didUpdate = false;

      for (const c of candidates) {
        const raw = c.val;
        if (!raw || !isLocalUpload(raw)) continue;
        // derive local path
        let rel = String(raw).replace(/^\//, '');
        if (rel.startsWith('uploads/')) rel = rel.replace(/^uploads\//, '');
        const localPath = path.join(UPLOADS_DIR, rel);
        if (fs.existsSync(localPath)) {
          console.log(`[restorans] will upload local file for restoran.id=${id} key=${c.key} -> ${localPath}`);
          if (!DRY) {
            try {
              const buffer = fs.readFileSync(localPath);
              const filename = path.basename(localPath);
              const dest = `restoran/${id}/${Date.now()}-${filename}`;
              const publicUrl = await uploadBufferToSupabase(buffer, dest, null);
              if (publicUrl) {
                if (c.key === 'documents_json.profile') {
                  updatedDocs = updatedDocs || {};
                  updatedDocs.profile = publicUrl;
                } else if (c.key === 'foto_path' || c.key === 'foto') {
                  // we will update foto_path field
                }
                // update DB row
                await supabase.from('restorans').update({ foto_path: publicUrl, foto_storage_provider: 'supabase', documents_json: updatedDocs ? JSON.stringify(updatedDocs) : null }).eq('id', id);
                didUpdate = true;
                console.log(`[restorans] updated restoran.id=${id} foto_path -> ${publicUrl}`);
              }
            } catch (e) {
              console.error(`[restorans] upload failed for restoran.id=${id}`, e.message || e);
            }
          }
        } else {
          console.warn(`[restorans] local file missing for restoran.id=${id} key=${c.key}: ${localPath}`);
          if (!DRY && NULL_MISSING) {
            try {
              // if documents_json.profile, null it; else clear foto fields
              if (c.key === 'documents_json.profile' && updatedDocs) {
                updatedDocs.profile = null;
                await supabase.from('restorans').update({ documents_json: JSON.stringify(updatedDocs) }).eq('id', id);
              } else {
                await supabase.from('restorans').update({ foto: null, foto_path: null, foto_storage_provider: null }).eq('id', id);
              }
              console.log(`[restorans] cleared legacy foto for restoran.id=${id}`);
            } catch (e) { console.error('[restorans] failed to clear fields', e.message || e); }
          }
        }
      }

      if (!didUpdate && updatedDocs && updatedDocs !== docs && !DRY) {
        try { await supabase.from('restorans').update({ documents_json: JSON.stringify(updatedDocs) }).eq('id', id); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    console.error('[restorans] error', e.message || e);
  }
}

async function main() {
  console.log('MIGRATE UPLOADS TO SUPABASE — dry=', DRY, 'nullMissing=', NULL_MISSING, 'limit=', LIMIT);
  await processMenus();
  await processRestorans();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error('fatal', e); process.exit(1); });
