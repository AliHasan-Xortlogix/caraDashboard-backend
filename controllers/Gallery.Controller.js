const Contacts = require('../models/Contact.models');
const Settings = require('../models/Setting.models');
const ContactCustomFields = require('../models/ContactCutsomField.models');
const CustomFields = require('../models/customFields.models');
const User = require('../models/user.models')
const getContactsWithCustomFields = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10 if not provided

        // Get user_id from req.user
        const user_id = req.user._id;
        console.log(user_id)
        // Fetch user to get location_id
        const user = await User.findById(user_id);
        console.log(user)
        if (!user) return res.status(404).json({ message: "User not found" });
        const locationId = user?.location_id; // Assuming user schema has location_id field
        console.log(locationId)
        // Fetch Basic Contact Data with Limit and Pagination
        const skip = (page - 1) * limit;
        const contacts = await Contacts.find({ location_id: locationId }).skip(skip).limit(limit);
        if (!contacts.length) return res.status(404).json({ message: "No contacts found" });

        // Fetch Standard Custom Fields
        const fieldNames = ["imagePath", "projectDate", "startTime", "finishTime", "relatedImages"];
        const customFields = await CustomFields.find({ cf_name: { $in: fieldNames } });

        // Create a mapping for standard field names to their IDs
        const fieldMap = customFields.reduce((acc, field) => {
            acc[field.cf_name] = field.id;
            return acc;
        }, {});

        // Fetch Display Settings
        const settings = await Settings.findOne({ key: "displaySetting" });
        if (!settings) return res.status(404).json({ message: "Display settings not found" });

        const displayFields = settings.value; // Assuming it's already in JSON format

        // Extract cf_ids for custom custom fields
        const displayCfIds = displayFields.map(field => field.cf_id);

        // Collect all contact IDs for batch querying
        const contactIds = contacts.map(contact => contact.id);

        // Fetch all ContactCustomFields in a single query for standard & custom fields
        const allCustomFieldValues = await ContactCustomFields.find({
            contact_id: { $in: contactIds },
            cf_id: { $in: [...Object.values(fieldMap), ...displayCfIds] }
        });

        // Organize Custom Field Values by Contact ID
        const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
            if (!acc[field.contact_id]) acc[field.contact_id] = {};
            acc[field.contact_id][field.cf_id] = field.value || null;
            return acc;
        }, {});

        // Process Contacts
        const formattedContacts = contacts.map(contact => {
            const fieldValues = contactFieldMap[contact.id] || {};

            let standardFields = {
                projectDate: null,
                startTime: null,
                finishTime: null
            };
            let cardCoverImage = null;
            let relatedImages = [];
            let customCustomFields = [];

            // Assign Standard Fields
            Object.entries(fieldMap).forEach(([fieldName, cfId]) => {
                if (fieldName === "imagePath") {
                    cardCoverImage = fieldValues[cfId] || null;
                } else if (fieldName === "relatedImages") {
                    relatedImages = fieldValues[cfId] ? fieldValues[cfId].split(",") : [];
                } else {
                    standardFields[fieldName] = fieldValues[cfId] || null;
                }
            });

            // Ensure All Custom Fields Are Included
            customCustomFields = displayFields.map(({ cf_id, cf_name }) => ({
                label: cf_name,
                value: fieldValues[cf_id] || null
            }));

            return {
                basicContactData: {
                    id: contact.id,
                    name: contact.name || "No Name",
                    location: contact.location || null,
                    vendor: contact.vendor || null,
                    tags: Array.isArray(contact.tags) ? contact.tags : (typeof contact.tags === "string" ? contact.tags.split(",") : []),
                    age: contact.age || null
                },
                cardCoverImage,
                standardCustomFields: standardFields,
                relatedImages,
                customCustomFields
            };
        });

        return res.status(200).json({
            contacts: formattedContacts,
            page,
            limit,
            totalContacts: await Contacts.countDocuments({ location_id: locationId }), // For total count in pagination
        });
    } catch (error) {
        console.error("Error fetching contacts:", error.message);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};





module.exports = {
    getContactsWithCustomFields,
};
