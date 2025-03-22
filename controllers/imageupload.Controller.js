const multer = require('multer');
const path = require('path');
const Settings = require('../models/Setting.models'); // Assuming Settings model is used to store settings

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
}).single('image'); // Single file upload with key 'image'

// Controller to handle image upload and store URL in the database
exports.uploadImage = (req, res) => {
    // Use multer to upload the image
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        // Get the key and the user_id from the request (assuming user is authenticated)
        const { key } = req.body;
        const user_id = req.user._id; 

        // Check if the key is either 'cover' or 'logo'
        if (key !== 'cover' && key !== 'logo') {
            return res.status(400).json({ message: "Invalid key. Only 'cover' or 'logo' are allowed." });
        }

        // Generate the image URL
        const imageUrl = `/uploads/${req.file.filename}`; // Assuming the public folder is configured to serve static files

        try {
            // Check if the setting already exists for the user
            const existingSetting = await Settings.findOne({ user_id, key });
            if (existingSetting) {
                // Update the existing setting with the new image URL
                existingSetting.value = imageUrl;
                existingSetting.updated_at = Date.now();
                await existingSetting.save();
                return res.status(200).json({ message: `${key} updated successfully`, setting: existingSetting });
            } else {
                // Create a new setting with the image URL
                const newSetting = new Settings({
                    user_id,
                    key,
                    value: imageUrl,
                });
                await newSetting.save();
                return res.status(201).json({ message: `${key} created successfully`, setting: newSetting });
            }
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'An error occurred while uploading the image' });
        }
    });
};
