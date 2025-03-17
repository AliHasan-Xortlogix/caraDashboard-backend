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
    const settings = req.body;  
    const user_id = req.user._id;  

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

            
            if (!key || !value) {
                return res.status(400).json({ message: "Both key and value are required" });
            }

            
            const existingSetting = await Settings.findOne({ user_id, key });

            if (existingSetting) {
      
                existingSetting.value = value;
                existingSetting.updated_at = Date.now();
                await existingSetting.save();
                response.push({ message: `Setting for key '${key}' updated successfully`, setting: existingSetting });
            } else {
           
                const newSetting = new Settings({
                    user_id,
                    key,
                    value,
                });
                await newSetting.save();
                response.push({ message: `Setting for key '${key}' created successfully`, setting: newSetting });
            }
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while creating or updating the settings' });
    }
};


