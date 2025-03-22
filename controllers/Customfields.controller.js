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
            // Check if a custom field already exists with the same user_id, cf_id, and location_id
            const existingField = await CustomField.findOne({
                user_id: userId,
                cf_id: field.id,
                location_id: locationId
            });

            if (existingField) {
                // If the custom field already exists, update it
                existingField.cf_name = field.name;
                existingField.cf_key = field.fieldKey;
                existingField.dataType = field.dataType;

                // Save the updated custom field
                await existingField.save();
                console.log(`Custom field with id ${field.id} updated`);
            } else {
                // If the custom field doesn't exist, create a new one
                const newCustomField = new CustomField({
                    cf_id: field.id,
                    cf_name: field.name,
                    cf_key: field.fieldKey,
                    dataType: field.dataType,
                    location_id: locationId,
                    user_id: userId,
                });

                // Save the new custom field
                await newCustomField.save();
                console.log(`Custom field with id ${field.id} created`);
            }
        }
        console.log('Custom fields successfully processed');
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
        console.log(customFields)
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
