const express = require('express');
const router = express.Router();
const { syncContact,createAppointment } = require('../controllers/webhook.controller');

router.post('/sync', syncContact);
router.post('/appointment/data', createAppointment);
module.exports = router;
