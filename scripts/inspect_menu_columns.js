const db = require('../config/db');
require('dotenv').config();

(async () => {
  try {
    const [rows] = await db.execute(
      "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'menu_makanan'",
      [process.env.DB_NAME]
    );
    console.log('Columns for menu_makanan:');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
