cd C:\RasoSehat-Projects\RasoSehat-Backend ; 
node server.js// Test script for admin user management endpoints using built-in http
const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testUserManagement() {
  try {
    console.log('Testing admin user management endpoints...\n');

    // Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'admin@rasosehat.com',
      password: 'admin123'
    });

    if (loginResponse.statusCode !== 200 || !loginResponse.data.token) {
      throw new Error('Login failed: ' + JSON.stringify(loginResponse.data));
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful, token obtained\n');

    // Test get all users
    console.log('2. Fetching all users...');
    const usersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (usersResponse.statusCode !== 200) {
      throw new Error('Failed to fetch users: ' + JSON.stringify(usersResponse.data));
    }

    const usersData = usersResponse.data;
    console.log('✅ Users fetched successfully');
    console.log(`Total users: ${usersData.data ? usersData.data.length : 0}`);
    if (usersData.data && usersData.data.length > 0) {
      console.log('Sample user:', JSON.stringify(usersData.data[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUserManagement();