const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/NotificationsController');
const { verifyToken } = require('../middleware/authmiddleware');

router.get('/', verifyToken, notificationsController.listForUser);
router.patch('/:id/read', verifyToken, notificationsController.markRead);
router.post('/mark-all-read', verifyToken, notificationsController.markAllRead);

module.exports = router;
