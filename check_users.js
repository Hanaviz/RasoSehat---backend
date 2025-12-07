// Check users in database (Supabase)
const supabase = require('./supabase/supabaseClient');

async function checkUsers() {
  try {
    console.log('Checking users in database...\n');

    const { data: users, error } = await supabase.from('users').select('id,name,email,phone,role,avatar,created_at,birth_date,gender').limit(10);
    if (error) throw error;

    console.log(`Found ${(users || []).length} users:`);
    (users || []).forEach(user => {
      console.log(`- ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });

  } catch (error) {
    console.error('Error:', error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
}

checkUsers();