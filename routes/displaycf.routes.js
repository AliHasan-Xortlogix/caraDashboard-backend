const express = require('express');
const router = express.Router();
const { getCustomFieldsByUser, DisplaySetting, getContactsByLocation } = require('../controllers/displaycfields.controller');  
const { isAuthenticatedUser } = require('../middleware/jwtToken');

// Route to get custom fields by user ID
router.get('/displaycfields', isAuthenticatedUser, getCustomFieldsByUser);
router.post('/displaysetting', isAuthenticatedUser, DisplaySetting);
router.get('/contactsall', isAuthenticatedUser,getContactsByLocation);
module.exports = router;
