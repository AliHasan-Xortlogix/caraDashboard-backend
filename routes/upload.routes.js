const express = require('express');
const multer = require('multer');
const path = require('path');
const homeController = require('../controllers/home.Controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
const router = express.Router();
// Show the input form
router.get("/", (req, res) => {
    res.render("index"); // Renders index.ejs
});
// Configure Multer for file upload
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, `upload-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Define the POST route for JSON upload
router.post('/import-leads',isAuthenticatedUser, upload.single('file'), homeController.processFile);

module.exports = router;
