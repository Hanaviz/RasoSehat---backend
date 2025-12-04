const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ statusCode: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async () => {
  try {
    console.log('Logging in...');
    const port = process.env.TEST_PORT || 3000;
    const login = await makeRequest({ hostname: 'localhost', port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'admin@rasosehat.com', password: 'admin123' });
    if (login.statusCode !== 200) return console.error('Login failed', login.data);
    const token = login.data.token;
    console.log('Token:', token && token.slice(0,10) + '...');

    console.log('Requesting /api/my-store');
    const res = await makeRequest({ hostname: 'localhost', port, path: '/api/my-store', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    console.log('Status:', res.statusCode);
    console.log('Body:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error', err.message || err);
  }
})();