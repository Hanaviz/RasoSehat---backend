const MenuModel = require('./models/MenuModel');

(async () => {
  try {
    const slug = 'buddha-bowl';
    console.log('Calling MenuModel.findBySlug...');
    const menu = await MenuModel.findBySlug(slug);
    console.log('Menu found:', !!menu);
    if (menu) {
      console.log('Menu data:', menu);
      console.log('diet_claims value (array):', menu.diet_claims || []);
    }
  } catch (err) {
    console.error('Error:', err);
    console.error('Stack:', err.stack);
  } finally {
    process.exit();
  }
})();