
const express = require('express');
const router = express.Router();
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
const { handleAuth, handleCallback } = require('../controllers/Ghlauth.Controller');

router.get('/auth', isAuthenticatedUser, handleAuth);

router.get('/crm/oauth_calllback', handleCallback);

module.exports = router;
