const express = require('express');
const router = express.Router();
const { getContactsWithCustomFields } = require('../controllers/Gallery.Controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
// Define route for getting all contacts with custom fields and display settings
router.get('/contacts', isAuthenticatedUser,getContactsWithCustomFields);

module.exports = router;
