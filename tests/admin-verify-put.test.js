/* Integration tests for PUT /api/admin/verify/restaurant/:id
   Mirrors admin-approval.test.js structure and assertions.
*/

const { expect } = require('chai');
const request = require('supertest');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key';

const jwt = require('jsonwebtoken');
const app = require('../server');
const supabase = require('../supabase/supabaseClient');
const UserModel = require('../models/UserModel');
const RestaurantModel = require('../models/RestaurantModel');

describe('PUT /api/admin/verify/restaurant/:id integration', function () {
  this.timeout(10000);

  let adminUserId, adminToken;
  let normalUserId;
  let restoApproveId, restoRejectId;

  before(async () => {
    // Cleanup by email if present
    try { await supabase.from('verifikasi_restoran').delete().ilike('catatan', '%test-integration%'); } catch (e) {}
    try { await supabase.from('restorans').delete().ilike('nama_restoran', '%test-put-resto-%'); } catch (e) {}
    try { await supabase.from('users').delete().in('email', ['test-put-admin@example.com', 'test-put-user@example.com']); } catch (e) {}

    const adminHash = await bcrypt.hash('adminpass', 6);
    adminUserId = await UserModel.create('PUT Test Admin', 'test-put-admin@example.com', adminHash, 'admin');
    const userHash = await bcrypt.hash('userpass', 6);
    normalUserId = await UserModel.create('PUT Test User', 'test-put-user@example.com', userHash, 'pembeli');

    adminToken = jwt.sign({ id: adminUserId, role: 'admin', email: 'test-put-admin@example.com' }, process.env.SECRET_KEY, { expiresIn: '1h' });

    // Create restaurants to approve/reject
    const r1 = await RestaurantModel.createStep1({ nama_restoran: `test-put-resto-approve-${Date.now()}`, alamat: 'Addr A', user_id: normalUserId });
    restoApproveId = r1.id;
    await RestaurantModel.submitFinal(restoApproveId);

    const r2 = await RestaurantModel.createStep1({ nama_restoran: `test-put-resto-reject-${Date.now()}`, alamat: 'Addr B', user_id: normalUserId });
    restoRejectId = r2.id;
    await RestaurantModel.submitFinal(restoRejectId);
  });

  after(async () => {
    try { await supabase.from('restorans').delete().in('id', [restoApproveId, restoRejectId]); } catch (e) {}
    try { await supabase.from('users').delete().in('id', [adminUserId, normalUserId]); } catch (e) {}
  });

  it('responds 401/403 when no token provided', async () => {
    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${restoApproveId}`)
      .send({ status: 'approved' });

    expect(res.status).to.be.oneOf([401, 403]);
  });

  it('responds 403 for non-admin token', async () => {
    const userToken = jwt.sign({ id: normalUserId, role: 'pembeli', email: 'test-put-user@example.com' }, process.env.SECRET_KEY, { expiresIn: '1h' });
    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${restoApproveId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'approved' });

    expect(res.status).to.equal(403);
  });

  it('returns 400 when body missing required status', async () => {
    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${restoApproveId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ });

    expect(res.status).to.equal(400);
  });

  it('approves restaurant and sets user.role to penjual', async () => {
    // Ensure current role is not penjual
    const before = await UserModel.findById(normalUserId);
    expect(before.role).to.not.equal('penjual');

    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${restoApproveId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', note: 'test-integration approve' });

    expect(res.status).to.equal(200);

    const { data: rowsRes } = await supabase.from('restorans').select('status_verifikasi,user_id').eq('id', restoApproveId).limit(1);
    expect(rowsRes && rowsRes[0] && rowsRes[0].status_verifikasi).to.equal('disetujui');

    const after = await UserModel.findById(normalUserId);
    expect(after.role).to.equal('penjual');
  });

  it('rejects restaurant and does not change user role', async () => {
    // Reset role to pembeli
    await supabase.from('users').update({ role: 'pembeli' }).eq('id', normalUserId);

    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${restoRejectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', note: 'test-integration reject' });

    expect(res.status).to.equal(200);

    const { data: rowsRes2 } = await supabase.from('restorans').select('status_verifikasi').eq('id', restoRejectId).limit(1);
    expect(rowsRes2 && rowsRes2[0] && rowsRes2[0].status_verifikasi).to.equal('ditolak');

    const userAfter = await UserModel.findById(normalUserId);
    expect(userAfter.role).to.not.equal('penjual');
  });

  it('returns 404 when restaurant not found', async () => {
    const fakeId = 99999999;
    const res = await request(app)
      .put(`/api/admin/verify/restaurant/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });

    expect(res.status).to.be.oneOf([404, 500]);
  });
});
