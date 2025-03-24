const Contacts = require('../models/Contact.models');
const Settings = require('../models/Setting.models');
const ContactCustomFields = require('../models/ContactCutsomField.models');
const CustomFields = require('../models/customFields.models');
const User = require('../models/user.models')
const mongoose = require('mongoose'); // Import mongoose
const ObjectId = mongoose.Types.ObjectId; // Get ObjectId
const getContactsWithCustomFields = async (req, res) => {
    try {
        const { page = 1, limit = 10, tags, startDate, endDate } = req.query; // Default to page 1 and limit 10 if not provided

        const user_id = req.user._id;
        console.log(user_id);

        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });
        const locationId = user.location_id;
        console.log(locationId);

        const skip = (page - 1) * limit;
        let query = { location_id: locationId };

        let tagList = [];
        if (tags && typeof tags === "string") {
            tagList = tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        console.log("Tag List:", tagList);

        let orConditions = [];

        if (tagList.length > 0) {
            const tagRegexArray = tagList.map(tag => {
                let regexPattern = new RegExp(`\\b${tag}\\b`, "i");
                return {
                    tags: { $regex: regexPattern.source, $options: "i" }
                };
            });
            orConditions.push(...tagRegexArray);
            console.log("Tag Regex Array:", JSON.stringify(tagRegexArray, null, 2));
        }

        const matchingCustomFields = await CustomFields.find({ cf_name: { $in: tagList } });
        const customFieldIds = matchingCustomFields.map(field => field._id);
        console.log('Matching CustomFields:', matchingCustomFields);

        let customFieldContacts = [];
        if (customFieldIds.length > 0) {
            const customFieldEntries = await ContactCustomFields.find({ custom_field_id: { $in: customFieldIds } });
            customFieldContacts = customFieldEntries.map(entry => entry.contact_id);
        }
        console.log('Matching Contact IDs for Custom Fields:', customFieldContacts);

        if (customFieldContacts.length > 0) {
            orConditions.push({ _id: { $in: customFieldContacts.map(id => new ObjectId(id)) } });
        }

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toISOString().split("T")[0]; // Extract YYYY-MM-DD
        };

        let dateMatchedContactIds = [];
        console.log(startDate, endDate);
        if (startDate || endDate) {
            let parsedStartDate = startDate ? formatDate(startDate) : null;
            let parsedEndDate = endDate ? formatDate(endDate) : null;

            console.log("Formatted Start Date:", parsedStartDate);
            console.log("Formatted End Date:", parsedEndDate);

            // Ensure the custom field "Project Date" exists
            const projectDateField = await CustomFields.findOne({ cf_name: "Project date" });

            if (projectDateField) {
                const projectDateFieldId = projectDateField._id;
                let dateFilterCondition = { custom_field_id: projectDateFieldId };

                if (parsedStartDate && parsedEndDate) {
                    // If both dates exist, filter within range
                    dateFilterCondition.value = { $gte: parsedStartDate, $lte: parsedEndDate };
                } else if (parsedStartDate) {
                    // If only startDate exists, filter for exact match
                    dateFilterCondition.value = parsedStartDate;
                }

                // Fetch contacts based on the Project Date filter
                const dateFilteredContacts = await ContactCustomFields.find(dateFilterCondition);
                console.log("Matching Contacts for Project Date:", dateFilteredContacts);

                // Store matching contact IDs
                const dateMatchedContactIds = dateFilteredContacts.map(entry => entry.contact_id);

                if (dateMatchedContactIds.length > 0) {
                    orConditions.push({ _id: { $in: dateMatchedContactIds.map(id => new ObjectId(id)) } });
                }
            } else {
                console.error("No 'Project date' custom field found.");
            }
        }

        // If there are matching contact IDs, apply the filter
        if (dateMatchedContactIds.length > 0) {
            orConditions.push({ _id: { $in: dateMatchedContactIds.map(id => new ObjectId(id)) } });
        }


        if (orConditions.length > 0) {
            query.$or = orConditions;
        }

        console.log("Final Query:", JSON.stringify(query, null, 2));

        const contacts = await Contacts.find(query).skip(skip).limit(Number(limit));
        if (!contacts.length) return res.status(404).json({ message: "No contacts found" });

        const fieldNames = ["Cover Image", "Project date", "startTime", "finishTime", "related images"];

        const customFields = await CustomFields.find({ cf_name: { $in: fieldNames } });

        const fieldMap = customFields.reduce((acc, field) => {
            acc[field.cf_name] = field.id;
            return acc;
        }, {});

        const settings = await Settings.findOne({ key: "displaySetting" });
        if (!settings) return res.status(404).json({ message: "Display settings not found" });

        const displayFields = settings.value;
        const settingmapcfIds = [];

        for (const field of displayFields) {
            const customField = await CustomFields.findOne({ cf_id: field.cf_id }); // Find the custom field
            settingmapcfIds.push({
                ...field,
                cf_id: customField ? customField._id.toString() : field.cf_id // Replace cf_id with _id if found
            });
        }
        console.log('ss', settingmapcfIds);
        const displayCfIds = displayFields.map(field => field.cf_id);
        const customFieldsid = await CustomFields.find({
            cf_id: { $in: displayCfIds }
        });
        const selectedcustomFieldIds = customFieldsid.map(field => field.id);
        const customFieldcfIds = customFields.map(field => field.id);
        console.log('custoMFieldIds', customFieldcfIds, selectedcustomFieldIds);
        const contactIds = contacts.map(contact => contact.id);
        const allCustomFieldIds = [...customFieldcfIds, ...selectedcustomFieldIds];
        const allCustomFieldValues = await ContactCustomFields.find({
            contact_id: { $in: contactIds },

            custom_field_id: { $in: allCustomFieldIds }

        });
        console.log('allCustomFieldValues', allCustomFieldValues)
        const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
            if (!acc[field.contact_id]) acc[field.contact_id] = {};
            acc[field.contact_id][field.custom_field_id] = field.value || null;
            return acc;
        }, {});
        console.log("jiu", contactFieldMap)
        const formattedContacts = contacts.map(contact => {
            const fieldValues = contactFieldMap[contact.id] || {};
            console.log(fieldValues, fieldMap);
            let standardFields = {
                projectDate: null,
                startTime: null,
                finishTime: null
            };
            let cardCoverImage = null;
            let relatedImages = [];
            let customCustomFields = [];

            Object.entries(fieldMap).forEach(([fieldName, cfId]) => {
                if (fieldName === "Cover Image") {
                    cardCoverImage = fieldValues[cfId] || null;
                } else if (fieldName === "related images") {
                    relatedImages = fieldValues[cfId] || [];
                } else {
                    standardFields[fieldName] = fieldValues[cfId] || null;
                }
            });
            console.log(settingmapcfIds);
            customCustomFields = settingmapcfIds.map(({ cf_id, cf_name }) => ({

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
