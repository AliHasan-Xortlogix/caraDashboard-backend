const Contacts = require('../models/Contact.models');
const Settings = require('../models/Setting.models');
const ContactCustomFields = require('../models/ContactCutsomField.models');
const CustomFields = require('../models/customFields.models');
const User = require('../models/user.models')
const mongoose = require('mongoose'); // Import mongoose
const ObjectId = mongoose.Types.ObjectId; // Get ObjectId
const getContactsWithCustomFields = async (req, res) => {
    try {
        const { page = 1, limit = 10, tags } = req.query; // Default to page 1 and limit 10 if not provided

        // Get user_id from req.user
        const user_id = req.user._id;
        console.log(user_id)
        // Fetch user to get location_id
        const user = await User.findById(user_id);
        console.log(user)
        if (!user) return res.status(404).json({ message: "User not found" });
        const locationId = user?.location_id;
        console.log(locationId)
        // // Fetch Basic Contact Data with Limit and Pagination
        const skip = (page - 1) * limit;
        // Build query object
        let query = { location_id: locationId };

        // Convert tags string into an array
        let tagList = [];
        if (tags && typeof tags === "string") {
            tagList = tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        console.log("Tag List:", tagList); // ✅ Check if tags are correctly parsed

        // Prepare the $or condition array
        let orConditions = [];

        // If tags exist, search in the `tags` array using `$regex`
        if (tagList.length > 0) {
            // const tagRegexArray = tagList.map(tag => {
            //     let regexPattern = new RegExp(`^${tag}$`, "i"); // ✅ Construct regex
            //     console.log(`Regex for ${tag}:`, regexPattern); // 🔍 Debugging regex
            //     return { tags: { $elemMatch: { $regex: regexPattern.source, $options: "i" } } }; // ✅ FIXED
            // });
            const tagRegexArray = tagList.map(tag => {
                let regexPattern = new RegExp(`\\b${tag}\\b`, "i"); // ✅ Define regex pattern

                return {
                    tags: {
                        $regex: regexPattern.source, // ✅ Use regex source
                        $options: "i" // ✅ Case-insensitive match
                    }
                };
            });
            console.log("Tag Regex Array:", JSON.stringify(tagRegexArray, null, 2)); // ✅ Check regex array
            orConditions.push(...tagRegexArray);
            console.log('orcondition', JSON.stringify(tagRegexArray));
        }

        // Fetch matching custom fields by cf_name
        const matchingCustomFields = await CustomFields.find({ cf_name: { $in: tagList } });
        console.log('Matching CustomFields:', matchingCustomFields);

        const customFieldIds = matchingCustomFields.map(field => field._id);
        console.log('Matching CustomField IDs:', customFieldIds);

        // Fetch matching contacts based on custom fields
        let customFieldContacts = [];
        if (customFieldIds.length > 0) {
            const customFieldEntries = await ContactCustomFields.find({ custom_field_id: { $in: customFieldIds } });
            console.log('Matching Contact Fields:', customFieldEntries);
            customFieldContacts = customFieldEntries.map(entry => entry.contact_id);
        }
        console.log('Matching Contact IDs:', customFieldContacts);

        // If customFieldContacts exist, add them to the OR condition
        if (customFieldContacts.length > 0) {
            orConditions.push({ _id: { $in: customFieldContacts.map(id => new ObjectId(id)) } });
        }

        // Apply $or condition only if there are valid conditions
        if (orConditions.length > 0) {
            query.$or = orConditions;
        }

        console.log("Final Query:", JSON.stringify(query, null, 2)); // ✅ Debug final query

        // Fetch contacts with filtering, pagination
        const contacts = await Contacts.find(query).skip(skip).limit(Number(limit));
        console.log('Query Results:', contacts.length);
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
            totalContacts: await Contacts.countDocuments(query),
        });
    } catch (error) {
        console.error("Error fetching contacts:", error.message);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// const getContactsWithCustomFields = async (req, res) => {
//     try {
//         // Get user_id from req.user
//         const user_id = req.user._id;
//         console.log(user_id);

//         // Fetch user to get location_id
//         const user = await User.findById(user_id);
//         console.log(user);
//         if (!user) return res.status(404).json({ message: "User not found" });

//         const locationId = user?.location_id;
//         console.log(locationId);

//         // Fetch all contacts for this location (without pagination)
//         const contacts = await Contacts.find({ location_id: locationId });
//         if (!contacts.length) return res.status(404).json({ message: "No contacts found" });

//         // Fetch Standard Custom Fields
//         const fieldNames = ["imagePath", "projectDate", "startTime", "finishTime", "relatedImages"];
//         const customFields = await CustomFields.find({ cf_name: { $in: fieldNames } });

//         // Create a mapping for standard field names to their IDs
//         const fieldMap = customFields.reduce((acc, field) => {
//             acc[field.cf_name] = field.id;
//             return acc;
//         }, {});

//         // Fetch Display Settings
//         const settings = await Settings.findOne({ key: "displaySetting" });
//         if (!settings) return res.status(404).json({ message: "Display settings not found" });

//         const displayFields = settings.value; // Assuming it's already in JSON format

//         // Extract cf_ids for custom custom fields
//         const displayCfIds = displayFields.map(field => field.cf_id);

//         // Collect all contact IDs for batch querying
//         const contactIds = contacts.map(contact => contact.id);

//         // Fetch all ContactCustomFields in a single query for standard & custom fields
//         const allCustomFieldValues = await ContactCustomFields.find({
//             contact_id: { $in: contactIds },
//             cf_id: { $in: [...Object.values(fieldMap), ...displayCfIds] }
//         });

//         // Organize Custom Field Values by Contact ID
//         const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
//             if (!acc[field.contact_id]) acc[field.contact_id] = {};
//             acc[field.contact_id][field.cf_id] = field.value || null;
//             return acc;
//         }, {});

//         // Process Contacts
//         const formattedContacts = contacts.map(contact => {
//             const fieldValues = contactFieldMap[contact.id] || {};

//             let standardFields = {
//                 projectDate: null,
//                 startTime: null,
//                 finishTime: null
//             };
//             let cardCoverImage = null;
//             let relatedImages = [];
//             let customCustomFields = [];

//             // Assign Standard Fields
//             Object.entries(fieldMap).forEach(([fieldName, cfId]) => {
//                 if (fieldName === "imagePath") {
//                     cardCoverImage = fieldValues[cfId] || null;
//                 } else if (fieldName === "relatedImages") {
//                     relatedImages = fieldValues[cfId] ? fieldValues[cfId].split(",") : [];
//                 } else {
//                     standardFields[fieldName] = fieldValues[cfId] || null;
//                 }
//             });

//             // Ensure All Custom Fields Are Included
//             customCustomFields = displayFields.map(({ cf_id, cf_name }) => ({
//                 label: cf_name,
//                 value: fieldValues[cf_id] || null
//             }));

//             return {
//                 basicContactData: {
//                     id: contact.id,
//                     name: contact.name || "No Name",
//                     location: contact.location || null,
//                     vendor: contact.vendor || null,
//                     tags: Array.isArray(contact.tags) ? contact.tags : (typeof contact.tags === "string" ? contact.tags.split(",") : []),
//                     age: contact.age || null
//                 },
//                 cardCoverImage,
//                 standardCustomFields: standardFields,
//                 relatedImages,
//                 customCustomFields
//             };
//         });

//         return res.status(200).json({
//             contacts: formattedContacts,
//             totalContacts: contacts.length, // For total count, using contacts.length
//         });
//     } catch (error) {
//         console.error("Error fetching contacts:", error.message);
//         return res.status(500).json({ message: "Internal server error", error: error.message });
//     }
// };




module.exports = {
    getContactsWithCustomFields,
};
