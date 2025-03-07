// controllers/settingsController.js
const Settings = require('../models/Settings');

// Function to create or update a setting based on the user_id from the query
exports.getUserSettings = async (req, res) => {
    const { user_id } = req.query;  // user_id from query string

    if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        // Fetch settings and populate the user details
        const settings = await Settings.find({ user_id })
            .populate('user_id', 'first_name last_name email role');  // Populate user details

        if (!settings || settings.length === 0) {
            return res.status(404).json({ message: "No settings found for this user" });
        }

        return res.status(200).json(settings);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while retrieving the settings' });
    }
};

exports.createOrUpdateSetting = async (req, res) => {
    const { key, value } = req.body;
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        // Check if the user exists before proceeding
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if the setting already exists for the given user_id and key
        const existingSetting = await Settings.findOne({ user_id, key });

        if (existingSetting) {
            // If it exists, update the setting
            existingSetting.value = value || existingSetting.value;
            existingSetting.updated_at = Date.now();
            await existingSetting.save();
            return res.status(200).json(existingSetting);
        } else {
           
            const newSetting = new Settings({
                user_id,
                key,
                value,
            });
            await newSetting.save();
            return res.status(201).json(newSetting);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while creating or updating the setting' });
    }
};
