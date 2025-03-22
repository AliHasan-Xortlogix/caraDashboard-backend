const CustomField = require("../models/customFields.models"); // Adjust the path as necessary
const DisplaySettingdb = require('../models/display.model')
const Setting = require('../models/Setting.models')
const Contact = require('../models/Contact.models')
const User = require('../models/user.models')
const mongoose = require('mongoose');
// Controller to get custom fields by user ID
const getCustomFieldsByUser = async (req, res) => {
    try {

        const userId = req.user._id;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }


        const customFields = await CustomField.find({ user_id: userId });


        if (customFields.length === 0) {
            return res.status(404).json({ message: "No custom fields found for this user" });
        }

        // Return the custom fields
        return res.status(200).json(customFields);

    } catch (error) {
        console.error("Error fetching custom fields:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};
const DisplaySetting = async (req, res) => {
    try {
        const user_id = req.user._id;
        const { displaySetting } = req.body;
        console.log(displaySetting)
        // Validate the incoming displaySetting array
        if (!Array.isArray(displaySetting) || displaySetting.length === 0) {
            return res.status(400).json({ message: 'Invalid data' });
        }

        // Check if settings already exist for this user
        let settings = await Setting.findOne({ user_id: user_id, key: 'displaySetting' });

        if (settings) {
            // If settings exist, update them with the new displaySetting
            settings.value = displaySetting;
            await settings.save();  // Save the updated settings
        } else {
            // If no settings exist for this user, create new settings
            settings = new Setting({
                user_id: user_id,
                key: 'displaySetting',
                value: displaySetting,
            });
            await settings.save();  // Save the new settings
        }

        return res.status(200).json({ message: 'Settings saved successfully' });

    } catch (error) {
        console.error('Error updating display settings:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}
const getContactsByLocation = async (req, res) => {
    try {

        const userId = req.user._id;


        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }


        const locationId = user.location_id;


        if (!locationId) {
            return res.status(400).json({ message: 'Location ID not available for the user' });
        }


        const contacts = await Contact.find({ location_id: locationId });


        if (contacts.length === 0) {
            return res.status(404).json({ message: 'No contacts found for this location' });
        }


        return res.status(200).json({ contacts });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
module.exports = {
    getCustomFieldsByUser,
    DisplaySetting,
    getContactsByLocation
};
