const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/SellerController');
const { verifyToken } = require('../middleware/authmiddleware');
const sellerOnly = require('../middleware/sellerOnly');

router.get('/my-store', verifyToken, sellerOnly, sellerController.getMyStore);

module.exports = router;
