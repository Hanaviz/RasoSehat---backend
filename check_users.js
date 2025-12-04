// Check users in database
const db = require('./config/db');

async function checkUsers() {
  try {
    console.log('Checking users in database...\n');

    // Get all users
    const [users] = await db.execute('SELECT id, name, email, phone, role, avatar, created_at, birth_date, gender FROM users LIMIT 10');

    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`- ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUsers();