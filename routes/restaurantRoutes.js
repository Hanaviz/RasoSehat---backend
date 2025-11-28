const express = require('express');
const router = express.Router();
const RestaurantController = require('../controllers/RestaurantController');
const { verifyToken, verifyPenjual } = require('../middleware/authmiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public: get all restaurants
router.get('/', RestaurantController.getAll);
// Public: get by id
router.get('/:id', RestaurantController.getById);

// Authenticated seller routes (multi-step registration)
router.post('/', verifyToken, verifyPenjual, RestaurantController.create);
router.put('/:id/step-2', verifyToken, verifyPenjual, RestaurantController.updateStep2);

// Step 3 file uploads: accept single files for each field
router.put('/:id/step-3', verifyToken, verifyPenjual, upload.fields([
  { name: 'foto_ktp', maxCount: 10 },
  { name: 'npwp', maxCount: 10 },
  { name: 'dokumen_usaha', maxCount: 10 }
]), RestaurantController.updateStep3);

router.put('/:id/submit', verifyToken, verifyPenjual, RestaurantController.submitFinal);

// Get restaurants by user
router.get('/user/:userId', verifyToken, RestaurantController.getByUserId);

module.exports = router;
