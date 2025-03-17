const express = require('express');
const router = express.Router();
const { getUserSettings, createOrUpdateSetting } = require('../controllers/settings.Controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');

router.get('/settings', isAuthenticatedUser, getUserSettings);
router.post('/settings', isAuthenticatedUser, createOrUpdateSetting);

module.exports = router; 
