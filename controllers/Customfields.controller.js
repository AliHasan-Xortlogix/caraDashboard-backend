const axios = require('axios');
const User = require('../models/user.models');
const CustomField = require('../models/customFields.models');
const Ghlauth = require('../models/Ghlauth.models');

// Function to fetch custom fields from GoHighLevel API
const getCustomFieldsFromGHL = async (locationId, accessToken) => {
    try {
        const response = await axios.get(`https://services.leadconnectorhq.com/locations/${locationId}/customFields`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28', // API version
            },
        });
        return response.data.customFields; // Return the custom fields data
    } catch (error) {
        console.error('Error fetching custom fields from GHL:', error);
        throw new Error('Failed to fetch custom fields');
    }
};

// Function to store custom fields in MongoDB
const storeCustomFields = async (customFields, locationId, userId) => {
    try {
        for (const field of customFields) {
            const newCustomField = new CustomField({
                cf_id: field.id,
                cf_name: field.name,
                cf_key: field.fieldKey,
                dataType: field.dataType,
                location_id: locationId,
                user_id: userId,
            });
            await newCustomField.save(); // Save each custom field to MongoDB
        }
        console.log('Custom fields successfully saved');
    } catch (error) {
        console.error('Error saving custom fields:', error);
        throw new Error('Failed to save custom fields');
    }
};

// Main controller function to handle the logic for fetching and saving custom fields
const fetchAndSaveCustomFields = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        const locationId = user.location_id;
        console.log(user, locationId)
        // Fetch the accessToken based on the locationId from Ghlauth model
        const ghlauthRecord = await Ghlauth.findOne({ location_id: locationId });
        if (!ghlauthRecord || !ghlauthRecord.access_token) {
            return res.status(400).json({ error: 'Access token not found for this location' });
        }
        const accessToken = ghlauthRecord.access_token;

        // Fetch custom fields from GoHighLevel API
        const customFields = await getCustomFieldsFromGHL(locationId, accessToken);

        // Store custom fields in the database
        await storeCustomFields(customFields, locationId, userId);

        return res.status(200).json({ message: 'Custom fields fetched and stored successfully' });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'An error occurred while fetching custom fields' });
    }
};

module.exports = {
    fetchAndSaveCustomFields,
};
