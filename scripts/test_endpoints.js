const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 3000, path, timeout: 5000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', err => reject(err));
  });
}

(async () => {
  try {
    console.log('Checking /api/menus/featured ...');
    const f = await get('/api/menus/featured');
    console.log('FEATURED STATUS', f.status);
    console.log(f.body);

    console.log('\nChecking /api/menus/slug/buddha-bowl ...');
    const s = await get('/api/menus/slug/buddha-bowl');
    console.log('SLUG STATUS', s.status);
    console.log(s.body);
  } catch (err) {
    console.error('Error testing endpoints:', err.message);
    process.exit(1);
  }
})();
