const Contacts = require('../models/Contact.models');
const Settings = require('../models/Setting.models');
const ContactCustomFields = require('../models/ContactCutsomField.models');
const CustomFields = require('../models/customFields.models');
const User = require('../models/user.models')
const mongoose = require('mongoose'); // Import mongoose
const ObjectId = mongoose.Types.ObjectId; // Get ObjectId

const getContactsWithCustomFields = async (req, res) => {
    try {
        const { page = 1, limit = 10, tags, startDate, endDate, sortName, sortDate } = req.query; // Default to page 1 and limit 10 if not provided

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

        function escapeRegExp(string) {
            return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');  // Escapes special characters
        }

        if (tagList.length > 0) {
            const tagRegexArray = tagList.map(tag => ({
                tags: { $regex: escapeRegExp(tag.trim()), $options: "i" }
            }));

            orConditions.push(...tagRegexArray);

            const nameRegexArray = tagList.map(tag => ({
                name: { $regex: escapeRegExp(tag.trim()), $options: "i" }
            }));

            orConditions.push(...nameRegexArray);

            console.log("Updated OR Conditions:", JSON.stringify(orConditions, null, 2));
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

        /*** ✅ Filter by Name ***/


        if (orConditions.length > 0) {
            query.$or = orConditions;
        }
        /*** ✅ Sorting ***/
        let sortDirection = 1; // Default: ascending
        if (sortName && sortName.toLowerCase() === "desc") {
            sortDirection = -1;
        }

        console.log("Final Query:", JSON.stringify(query, null, 2));

        const contacts = await Contacts.find(query)
            .sort({ name: sortDirection }) // Sort by name
            .skip(skip)
            .limit(Number(limit));

        //console.log("Contacts:", contacts);
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
        let formattedContacts = contacts.map(contact => {
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
        formattedContacts.sort((a, b) => {
            const aDate = a.standardCustomFields?.projectDate
                ? new Date(a.standardCustomFields.projectDate)
                : null;

            const bDate = b.standardCustomFields?.projectDate
                ? new Date(b.standardCustomFields.projectDate)
                : null;

            console.log(aDate, bDate);

            if (!aDate && !bDate) return 0; // If both are null, keep order
            if (!aDate) return 1; // Move null dates to the end
            if (!bDate) return -1; // Move null dates to the end

            return sortDate?.toLowerCase() === "asc"
                ? aDate - bDate
                : bDate - aDate;
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
//         const {
//             page = 1,
//             limit = 10,
//             tags,
//             startDate,
//             endDate,
//             name,
//             nameSort,
//             dateSort,
//             sortname
//         } = req.query;

//         const user_id = req.user._id;
//         console.log("User ID:", user_id);

//         const user = await User.findById(user_id);
//         if (!user) return res.status(404).json({ message: "User not found" });

//         const locationId = user.location_id;
//         console.log("Location ID:", locationId);

//         const skip = (page - 1) * limit;
//         let query = { location_id: locationId };

//         /*** ✅ Filter by Tags ***/
//         let tagList = tags ? tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
//         let orConditions = [];

//         if (tagList.length > 0) {
//             orConditions.push(...tagList.map(tag => ({
//                 tags: { $regex: new RegExp(`\\b${tag}\\b`, "i") }
//             })));
//         }

//         /*** ✅ Filter by Custom Fields ***/
//         const matchingCustomFields = await CustomFields.find({ cf_name: { $in: tagList } });
//         const customFieldIds = matchingCustomFields.map(field => field._id);

//         if (customFieldIds.length > 0) {
//             const customFieldEntries = await ContactCustomFields.find({ custom_field_id: { $in: customFieldIds } });
//             const customFieldContacts = customFieldEntries.map(entry => entry.contact_id);
//             if (customFieldContacts.length > 0) {
//                 orConditions.push({ _id: { $in: customFieldContacts } });
//             }
//         }

//         /*** ✅ Filter by Date Range ***/
//         const formatDate = dateString => new Date(dateString).toISOString().split("T")[0];

//         if (startDate || endDate) {
//             const parsedStartDate = startDate ? formatDate(startDate) : null;
//             const parsedEndDate = endDate ? formatDate(endDate) : null;

//             const projectDateField = await CustomFields.findOne({ cf_name: "Project date" });
//             if (projectDateField) {
//                 let dateFilterCondition = { custom_field_id: projectDateField._id };
//                 if (parsedStartDate && parsedEndDate) {
//                     dateFilterCondition.value = { $gte: parsedStartDate, $lte: parsedEndDate };
//                 } else if (parsedStartDate) {
//                     dateFilterCondition.value = parsedStartDate;
//                 }

//                 const dateFilteredContacts = await ContactCustomFields.find(dateFilterCondition);
//                 const dateMatchedContactIds = dateFilteredContacts.map(entry => entry.contact_id);
//                 if (dateMatchedContactIds.length > 0) {
//                     orConditions.push({ _id: { $in: dateMatchedContactIds } });
//                 }
//             }
//         }

//         /*** ✅ Filter by Name ***/
//         if (nameSort && nameSort.trim().length > 0) {
//             orConditions.push({ name: { $regex: new RegExp(name.trim(), "i") } });
//         }

//         /*** ✅ Apply OR conditions if any ***/
//         if (orConditions.length > 0) {
//             query.$or = orConditions;
//         }

//         console.log("Final Query:", JSON.stringify(query, null, 2));

//         /*** ✅ Sorting ***/
//         let sortDirection = 1; // Default: ascending
//         if (sortname && sortname.toLowerCase() === "desc") {
//             sortDirection = -1;
//         }

//         /*** ✅ Fetch Contacts ***/
//         const contacts = await Contacts.find(query)
//             .sort({ name: sortDirection }) // Sort by name
//             .skip(skip)
//             .limit(Number(limit));

//         if (!contacts.length) return res.status(404).json({ message: "No contacts found" });

//         /*** ✅ Fetch Required Custom Fields ***/
//         const fieldNames = ["Cover Image", "Project date", "startTime", "finishTime", "related images"];
//         const customFields = await CustomFields.find({ cf_name: { $in: fieldNames } });

//         const fieldMap = customFields.reduce((acc, field) => {
//             acc[field.cf_name] = field.id;
//             return acc;
//         }, {});

//         /*** ✅ Fetch Display Settings ***/
//         const settings = await Settings.findOne({ key: "displaySetting" });
//         if (!settings) return res.status(404).json({ message: "Display settings not found" });

//         const displayFields = settings.value;
//         const displayCfIds = displayFields.map(field => field.cf_id);

//         const customFieldsid = await CustomFields.find({ cf_id: { $in: displayCfIds } });
//         const selectedcustomFieldIds = customFieldsid.map(field => field.id);
//         const contactIds = contacts.map(contact => contact.id);
//         const allCustomFieldIds = [...customFields.map(field => field.id), ...selectedcustomFieldIds];

//         /*** ✅ Fetch Custom Field Values ***/
//         const allCustomFieldValues = await ContactCustomFields.find({
//             contact_id: { $in: contactIds },
//             custom_field_id: { $in: allCustomFieldIds }
//         });

//         const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
//             if (!acc[field.contact_id]) acc[field.contact_id] = {};
//             acc[field.contact_id][field.custom_field_id] = field.value || null;
//             return acc;
//         }, {});

//         /*** ✅ Format Contact Data ***/
//         const formattedContacts = contacts.map(contact => {
//             const fieldValues = contactFieldMap[contact.id] || {};

//             let standardFields = { projectDate: null, startTime: null, finishTime: null };
//             let cardCoverImage = null;
//             let relatedImages = [];
//             let customCustomFields = [];

//             Object.entries(fieldMap).forEach(([fieldName, cfId]) => {
//                 if (fieldName === "Cover Image") {
//                     cardCoverImage = fieldValues[cfId] || null;
//                 } else if (fieldName === "related images") {
//                     relatedImages = fieldValues[cfId] || [];
//                 } else {
//                     standardFields[fieldName] = fieldValues[cfId] || null;
//                 }
//             });

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

//         /*** ✅ Sort by Project Date if needed ***/
//         formattedContacts.sort((a, b) => {
//             const aDate = new Date(a.standardCustomFields.projectDate || 0);
//             const bDate = new Date(b.standardCustomFields.projectDate || 0);
//             return dateSort && dateSort.toLowerCase() === "asc" ? aDate - bDate : bDate - aDate;
//         });

//         return res.status(200).json({
//             contacts: formattedContacts,
//             page,
//             limit,
//             totalContacts: await Contacts.countDocuments(query),
//         });
//     } catch (error) {
//         console.error("Error fetching contacts:", error.message);
//         return res.status(500).json({ message: "Internal server error", error: error.message });
//     }
// };

const getSingleContact = async (req, res) => {
    try {
        const { contact_id, location_id } = req.query;
        if (!contact_id) return res.status(400).json({ message: "contact_id is required" });
        // const user_id = req.user.id;
        // console.log(user_id)
        // const user = await User.findById(user_id);
        // if (!user) return res.status(404).json({ message: "User not found" });
        // const locationId = user.location_id;
        // Fetch the single contact
        const contact = await Contacts.findOne({
            contact_id: contact_id,
            location_id: location_id
        });
        console.log(contact)
        if (!contact) return res.status(404).json({ message: "Contact not found" });
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
            const customField = await CustomFields.findOne({ cf_id: field.cf_id });
            settingmapcfIds.push({
                ...field,
                cf_id: customField ? customField._id.toString() : field.cf_id
            });
        }
        const displayCfIds = displayFields.map(field => field.cf_id);
        const customFieldsid = await CustomFields.find({
            cf_id: { $in: displayCfIds }
        });
        const selectedcustomFieldIds = customFieldsid.map(field => field.id);
        const customFieldcfIds = customFields.map(field => field.id);
        const allCustomFieldIds = [...customFieldcfIds, ...selectedcustomFieldIds];
        const allCustomFieldValues = await ContactCustomFields.find({
            contact_id: contact.id,
            custom_field_id: { $in: allCustomFieldIds }
        });
        const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
            if (!acc[field.contact_id]) acc[field.contact_id] = {};
            acc[field.contact_id][field.custom_field_id] = field.value || null;
            return acc;
        }, {});
        const fieldValues = contactFieldMap[contact.id] || {};
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
        customCustomFields = settingmapcfIds.map(({ cf_id, cf_name }) => ({
            label: cf_name,
            value: fieldValues[cf_id] || null
        }));
        const formattedContact = {
            basicContactData: {
                id: contact.contact_id,
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
        return res.status(200).json({ contact: formattedContact });
    } catch (error) {
        console.error("Error fetching single contact:", error.message);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


module.exports = {
    getContactsWithCustomFields, getSingleContact
};
