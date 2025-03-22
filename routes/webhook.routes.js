const express = require('express');
const router = express.Router();
const { syncContact } = require('../controllers/webhook.controller');

router.post('/sync', syncContact);

module.exports = router;