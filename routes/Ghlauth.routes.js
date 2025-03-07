
const express = require('express');
const router = express.Router();
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
const { handleAuth } = require('../controllers/Ghlauth.Controller');

router.get('/auth', isAuthenticatedUser ,handleAuth);



module.exports = router;