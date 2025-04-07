const express = require('express');
const router = express.Router();
const { getContactsWithCustomFields, getSingleContact } = require('../controllers/Gallery.Controller');

const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
const { getSuggestion } = require('../controllers/suggestion.Controller');
// Define route for getting all contacts with custom fields and display settings
router.get('/galleryview', isAuthenticatedUser,getContactsWithCustomFields);
router.get('/contactsview', getSingleContact);
router.get('/search-suggestions', getSuggestion)
module.exports = router;
