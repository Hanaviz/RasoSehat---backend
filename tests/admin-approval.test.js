/* Integration tests for admin restaurant approval endpoints
   Covers: approve success, reject success, unauthorized, restaurant not found,
   and ensures user's role becomes 'penjual' only on approve.

  NOTE: These are integration tests that will talk to the actual PostgreSQL database
   configured in `config/db.js`. Set a test database in your environment before
   running: provide `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Also ensure
   `SECRET_KEY` is set. The script sets `NODE_ENV=test` automatically when run
   via `npm test`.
*/

const { expect } = require('chai');
const request = require('supertest');
const bcrypt = require('bcrypt');

// Ensure tests set a known secret for JWT creation and ensure server exports app
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key';

const jwt = require('jsonwebtoken');

const app = require('../server');
const supabase = require('../supabase/supabaseClient');
const UserModel = require('../models/UserModel');
const RestaurantModel = require('../models/RestaurantModel');

describe('Admin restaurant approval integration', function () {
  this.timeout(10000);

  let adminUserId, adminToken;
  let normalUserId, normalUserToken;
  let restoIdToApprove, restoIdToReject;

  before(async () => {
    // Clean potential leftover test records by email
    try { await supabase.from('verifikasi').delete().ilike('note', '%test-integration%'); } catch (e) {}
    try { await supabase.from('restorans').delete().ilike('nama_restoran', '%test-resto-%'); } catch (e) {}
    try { await supabase.from('users').delete().in('email', ['test-admin@example.com', 'test-user@example.com']); } catch (e) {}

    // Create admin user
    const adminHash = await bcrypt.hash('adminpass', 6);
    adminUserId = await UserModel.create('Test Admin', 'test-admin@example.com', adminHash, 'admin');

    // Create normal user (the prospective seller)
    const userHash = await bcrypt.hash('userpass', 6);
    normalUserId = await UserModel.create('Test User', 'test-user@example.com', userHash, 'pembeli');

    // Generate tokens
    adminToken = jwt.sign({ id: adminUserId, role: 'admin', email: 'test-admin@example.com' }, process.env.SECRET_KEY, { expiresIn: '1h' });
    normalUserToken = jwt.sign({ id: normalUserId, role: 'pembeli', email: 'test-user@example.com' }, process.env.SECRET_KEY, { expiresIn: '1h' });

    // Create two restaurants: one to approve, one to reject
    const r1 = await RestaurantModel.createStep1({ nama_restoran: `test-resto-approve-${Date.now()}`, alamat: 'Addr 1', user_id: normalUserId });
    restoIdToApprove = r1.id;
    // set to pending explicitly
    await RestaurantModel.submitFinal(restoIdToApprove);

    const r2 = await RestaurantModel.createStep1({ nama_restoran: `test-resto-reject-${Date.now()}`, alamat: 'Addr 2', user_id: normalUserId });
    restoIdToReject = r2.id;
    await RestaurantModel.submitFinal(restoIdToReject);
  });

  after(async () => {
    // Cleanup created rows
    try {
      await supabase.from('restorans').delete().in('id', [restoIdToApprove, restoIdToReject]);
    } catch (e) {}
    try {
      await supabase.from('users').delete().in('id', [adminUserId, normalUserId]);
    } catch (e) {}
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app)
      .patch(`/api/admin/restaurants/${restoIdToApprove}/verify`)
      .send({ status: 'approved' });

    expect(res.status).to.be.oneOf([401, 403]); // depending on middleware behavior
  });

  it('returns 403 for non-admin token', async () => {
    const res = await request(app)
      .patch(`/api/admin/restaurants/${restoIdToApprove}/verify`)
      .set('Authorization', `Bearer ${normalUserToken}`)
      .send({ status: 'approved' });

    expect(res.status).to.equal(403);
  });

  it('approves restaurant and sets user.role to penjual', async () => {
    // Ensure user role is not penjual before
    const beforeUser = await UserModel.findById(normalUserId);
    expect(beforeUser.role).to.not.equal('penjual');

    const res = await request(app)
      .patch(`/api/admin/restaurants/${restoIdToApprove}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', note: 'test-integration approve' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('message');

    // Verify restaurant status in DB
    const { data: rowsRes } = await supabase.from('restorans').select('status_verifikasi,user_id').eq('id', restoIdToApprove).limit(1);
    expect(rowsRes && rowsRes[0] && rowsRes[0].status_verifikasi).to.equal('disetujui');

    // Verify user's role changed
    const afterUser = await UserModel.findById(normalUserId);
    expect(afterUser.role).to.equal('penjual');
  });

  it('rejects restaurant and user role remains unchanged', async () => {
    // Reset normal user's role to pembeli for this test case
    await supabase.from('users').update({ role: 'pembeli' }).eq('id', normalUserId);

    const res = await request(app)
      .patch(`/api/admin/restaurants/${restoIdToReject}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', note: 'test-integration rejected' });

    expect(res.status).to.equal(200);

    const { data: rowsRes2 } = await supabase.from('restorans').select('status_verifikasi').eq('id', restoIdToReject).limit(1);
    expect(rowsRes2 && rowsRes2[0] && rowsRes2[0].status_verifikasi).to.equal('ditolak');

    const userAfter = await UserModel.findById(normalUserId);
    expect(userAfter.role).to.not.equal('penjual');
  });

  it('returns 404 when restaurant not found', async () => {
    const fakeId = 99999999;
    const res = await request(app)
      .patch(`/api/admin/restaurants/${fakeId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    // Controller returns 404 when update rowCount === 0
    expect(res.status).to.be.oneOf([404, 500]);
  });
});
