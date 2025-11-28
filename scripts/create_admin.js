#!/usr/bin/env node
// Dev helper: create or promote an admin user for local testing
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function upsertAdmin(email, password, name = 'Admin') {
  try {
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const passwordHash = await bcrypt.hash(password, 10);

    if (rows && rows.length) {
      const id = rows[0].id;
      await pool.execute('UPDATE users SET password = ?, role = ? WHERE id = ?', [passwordHash, 'admin', id]);
      console.log(`Updated existing user id=${id} to role=admin`);
      return id;
    }

    const [result] = await pool.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, 'admin']);
    console.log(`Created new admin user id=${result.insertId}`);
    return result.insertId;
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
