const supabase = require('../supabase/supabaseClient');
require('dotenv').config();

(async () => {
  try {
    // Try to query information_schema via Supabase (may work depending on DB permissions)
    const { data, error } = await supabase.from('information_schema.columns').select('column_name,is_nullable,data_type,column_default').eq('table_name','menu_makanan');
    if (error) {
      console.warn('Could not query information_schema via Supabase client. Please run the SQL manually to inspect columns.');
      console.warn("SQL: SELECT column_name, is_nullable, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_makanan';");
      process.exit(1);
    }
    console.log('Columns for menu_makanan:');
    console.table(data || []);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
