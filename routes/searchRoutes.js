const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/SearchController');

// GET /search?q=...
router.get('/', SearchController.search);

module.exports = router;
