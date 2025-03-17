const multer = require('multer');
const path = require('path');

// Define storage settings for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/'); // Store images in the 'public/uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Give the file a unique name
    }
});

// Filter to allow only image files
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true); // Accept file
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and GIF are allowed.'));
    }
};

const upload = multer({
    storage,
    fileFilter
});

module.exports = upload;
