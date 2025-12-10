const supabase = require('../supabase/supabaseClient');

// Ensure bahan names exist and return their ids (accepts array of ids or names)
async function resolveBahanIds(items = []) {
  const resultIds = [];
  for (const it of items) {
    if (!it && it !== 0) continue;
    if (typeof it === 'number' || /^[0-9]+$/.test(String(it))) {
      resultIds.push(Number(it));
      continue;
    }
    const name = String(it).trim();
    if (!name) continue;
    // try find existing
    const { data: existing } = await supabase.from('bahan_baku').select('id').ilike('nama', `%${name}%`).limit(1);
    if (existing && existing.length) {
      resultIds.push(existing[0].id);
      continue;
    }
    // insert new
    const { data: inserted } = await supabase.from('bahan_baku').insert({ nama: name }).select('id').single();
    if (inserted && inserted.id) resultIds.push(inserted.id);
  }
  return resultIds;
}

async function resolveDietIds(items = []) {
  const resultIds = [];
  for (const it of items) {
    if (!it && it !== 0) continue;
    if (typeof it === 'number' || /^[0-9]+$/.test(String(it))) {
      resultIds.push(Number(it));
      continue;
    }
    const name = String(it).trim();
    if (!name) continue;
    const { data: existing } = await supabase.from('diet_claims_list').select('id').ilike('nama', `%${name}%`).limit(1);
    if (existing && existing.length) {
      resultIds.push(existing[0].id);
      continue;
    }
    const { data: inserted } = await supabase.from('diet_claims_list').insert({ nama: name }).select('id').single();
    if (inserted && inserted.id) resultIds.push(inserted.id);
  }
  return resultIds;
}

// Sync menu pivot tables: remove existing, insert new set
async function syncMenuBahan(menuId, bahanItems = []) {
  if (!menuId) return;
  // resolve to ids
  const ids = await resolveBahanIds(Array.isArray(bahanItems) ? bahanItems : [bahanItems]);
  // delete existing pivots
  await supabase.from('menu_bahan_baku').delete().eq('menu_id', menuId);
  if (!ids.length) return;
  const payload = ids.map(bid => ({ menu_id: menuId, bahan_baku_id: bid }));
  await supabase.from('menu_bahan_baku').insert(payload);
}

async function syncMenuDietClaims(menuId, dietItems = []) {
  if (!menuId) return;
  const ids = await resolveDietIds(Array.isArray(dietItems) ? dietItems : [dietItems]);
  await supabase.from('menu_diet_claims').delete().eq('menu_id', menuId);
  if (!ids.length) return;
  const payload = ids.map(did => ({ menu_id: menuId, claim_id: did }));
  await supabase.from('menu_diet_claims').insert(payload);
}

module.exports = {
  resolveBahanIds,
  resolveDietIds,
  syncMenuBahan,
  syncMenuDietClaims
};
