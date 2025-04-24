const express = require("express");
const router = express.Router();
const upload = require("../middleware/multer"); // Your multer setup
const { uploadCropped } = require("../controllers/cropped.controller");

// POST /api/upload-cropped
router.post('/crop', upload.single("croppedImage"), uploadCropped);

module.exports = router;
