const express = require('express');
const router = express.Router();
const { autoAuthController } = require('../controllers/Autoauth.Controller');

router.get('/auth/connect', autoAuthController);

module.exports = router;
