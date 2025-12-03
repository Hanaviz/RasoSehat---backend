const express = require('express');
const router = express.Router();
const RestaurantController = require('../controllers/RestaurantController');
const { verifyToken } = require('../middleware/authmiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public: get all restaurants
router.get('/', RestaurantController.getAll);
// Public: get by id
router.get('/:id', RestaurantController.getById);

// Authenticated routes for multi-step registration
// Allow any authenticated user to start the registration flow. Role-checking
// (penjual) is intentionally omitted so users can register and then be
// approved/converted to a seller during the workflow. This avoids 403 when
// a logged-in user with role 'pembeli' attempts to create a store.
router.post('/', verifyToken, RestaurantController.create);
router.put('/:id/step-2', verifyToken, RestaurantController.updateStep2);

// Step 3 file uploads: accept single files for each field
router.put('/:id/step-3', verifyToken, upload.fields([
  { name: 'foto_ktp', maxCount: 10 },
  { name: 'npwp', maxCount: 10 },
  { name: 'dokumen_usaha', maxCount: 10 }
]), RestaurantController.updateStep3);

router.put('/:id/submit', verifyToken, RestaurantController.submitFinal);

// Get restaurants by user
router.get('/user/:userId', verifyToken, RestaurantController.getByUserId);

module.exports = router;
