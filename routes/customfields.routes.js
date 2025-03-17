const express = require('express');
const { fetchAndSaveCustomFields } = require('../controllers/Customfields.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');

const router = express.Router();

// Protected route to fetch and save custom fields
router.route('/custom-fields')
    .get(isAuthenticatedUser, fetchAndSaveCustomFields);

module.exports = router;
