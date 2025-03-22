const express = require('express');
const router = express.Router();
const upload=require('../middleware/multer')
const { uploadImage } = require('../controllers/imageupload.Controller');
const { getUserSettings, createOrUpdateSetting } = require('../controllers/settings.Controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');

router.get('/settings', isAuthenticatedUser, getUserSettings);
router.post('/settings', isAuthenticatedUser, createOrUpdateSetting);
router.post('/upload-image', isAuthenticatedUser, uploadImage)
module.exports = router; 
