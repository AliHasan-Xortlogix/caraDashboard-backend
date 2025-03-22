const Settings = require('../models/Setting.models');
const User = require('../models/user.models');
exports.getUserSettings = async (req, res) => {
    const user_id = req.user._id;
    try {

        const settings = await Settings.find({ user_id })
            .populate('user_id', 'first_name last_name email role');

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
    // Access settings from the request body
    const settings = req.body.settings;  // Updated to use req.body.settings
    const user_id = req.user._id;

    // Log the settings to ensure it's being passed correctly
    console.log(settings);

    // Check if settings is an array and contains data
    if (!Array.isArray(settings) || settings.length === 0) {
        return res.status(400).json({ message: "Key-value pairs are required" });
    }

    try {
        // Check if the user exists before proceeding
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Loop through each key-value pair and process them
        const response = [];
        for (let setting of settings) {
            const { key, value } = setting;

            // Log each setting to check if key and value are correct
            console.log("Ye key ha", key, value);

            // If either key or value is missing, return an error
            if (!key || !value) {
                return res.status(400).json({ message: "Both key and value are required" });
            }

            // Check if the setting already exists for the user
            const existingSetting = await Settings.findOne({ user_id, key });
console.log(existingSetting);
            if (existingSetting) {
                // If setting exists, update it
                existingSetting.value = value;
                existingSetting.updated_at = Date.now();
                await existingSetting.save();
                response.push({ message: `Setting for key '${key}' updated successfully`, setting: existingSetting });
            } else {
                // If setting does not exist, create a new one
                const newSetting = new Settings({
                    user_id,
                    key,
                    value,
                });
                await newSetting.save();
                response.push({ message: `Setting for key '${key}' created successfully`, setting: newSetting });
            }
        }

        // Return the response with all processed settings
        return res.status(200).json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while creating or updating the settings' });
    }
};



