// Test script for delete user endpoint
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

async function testDeleteUser() {
  try {
    console.log('Testing delete user endpoint...\n');

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

    // Get all users first
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
    console.log(`✅ Found ${usersData.data ? usersData.data.length : 0} users`);

    // Find a non-admin user to delete
    const nonAdminUsers = usersData.data.filter(u => u.role !== 'admin');
    if (nonAdminUsers.length === 0) {
      console.log('⚠️ No non-admin users found to delete');
      return;
    }

    const userToDelete = nonAdminUsers[0];
    console.log(`3. Deleting user: ${userToDelete.name} (ID: ${userToDelete.id}, Role: ${userToDelete.role})...`);

    // Delete the user
    const deleteResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/users/${userToDelete.id}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Delete response status: ${deleteResponse.statusCode}`);
    console.log('Response:', JSON.stringify(deleteResponse.data, null, 2));

    if (deleteResponse.statusCode === 200) {
      console.log('✅ User deleted successfully!');
    } else {
      console.log('❌ Failed to delete user');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDeleteUser();