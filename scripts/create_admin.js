#!/usr/bin/env node
// Dev helper: create or promote an admin user for local testing
const bcrypt = require('bcrypt');
const supabase = require('../supabase/supabaseClient');

async function upsertAdmin(email, password, name = 'Admin') {
  try {
    const { data: rowsRes, error: selErr } = await supabase.from('users').select('id').eq('email', email).limit(1);
    const passwordHash = await bcrypt.hash(password, 10);

    if (selErr) throw selErr;
    if (rowsRes && rowsRes.length) {
      const id = rowsRes[0].id;
      await supabase.from('users').update({ password: passwordHash, role: 'admin' }).eq('id', id);
      console.log(`Updated existing user id=${id} to role=admin`);
      return id;
    }

    const { data: insertRes, error: insErr } = await supabase.from('users').insert({ name, email, password: passwordHash, role: 'admin' }).select('id');
    if (insErr) throw insErr;
    const newId = insertRes && insertRes[0] ? insertRes[0].id : null;
    console.log(`Created new admin user id=${newId}`);
    return newId;
  } catch (err) {
    console.error('Failed to create/promote admin user:', err.message || err);
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.error('Usage: node scripts/create_admin.js <email> <password> [name]');
    process.exit(1);
  }
  const [email, password, name] = argv;
  const id = await upsertAdmin(email, password, name || 'Admin');
  console.log('\nNext steps:');
  console.log(`1) Login via API to obtain token:`);
  console.log(`   curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"${email}","password":"${password}"}'`);
  console.log('2) Paste returned token into browser console:');
  console.log('   localStorage.setItem("access_token", "<TOKEN>"); window.location.reload();');
  console.log('\nCreated admin id=' + id + '.');
  process.exit(0);
}

main();
