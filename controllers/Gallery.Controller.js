const Contacts = require('../models/Contact.models');
const Settings = require('../models/Setting.models');
const ContactCustomFields = require('../models/ContactCutsomField.models');
const CustomFields = require('../models/customFields.models');
const User = require('../models/user.models')
const mongoose = require('mongoose'); // Import mongoose
const { Console } = require('winston/lib/winston/transports');
const ObjectId = mongoose.Types.ObjectId; // Get ObjectId

const getContactsWithCustomFields = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 16,
            tags,
            startDate,
            endDate,
            sortName,
            sortDate
        } = req.query;

        const user_id = req.user._id;
        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const locationId = user.location_id;
        const skip = (page - 1) * limit;
        let query = { location_id: locationId };

        /*** 🔍 Handle Tags & Name Search ***/
        let tagList = [];
        if (tags && typeof tags === "string") {
            tagList = tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        const escapeRegExp = (string) =>
            string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

        let orConditions = [];

        // Fetch all custom fields for this location once
        const allCustomFields = await CustomFields.find({ location_id: locationId });
        console.log(allCustomFields)
        if (tagList.length > 0) {
            const tagRegexArray = tagList.map(tag => ({
                tags: { $regex: escapeRegExp(tag), $options: "i" }
            }));

            const nameRegexArray = tagList.map(tag => ({
                name: { $regex: escapeRegExp(tag), $options: "i" }
            }));

            orConditions.push(...tagRegexArray, ...nameRegexArray);

            const matchingCustomFields = allCustomFields.filter(field =>
                tagList.includes(field.cf_name)
            );
            const customFieldIds = matchingCustomFields.map(field => field._id);

            if (customFieldIds.length > 0) {
                const customFieldEntries = await ContactCustomFields.find({
                    custom_field_id: { $in: customFieldIds }
                });

                const customFieldContacts = customFieldEntries.map(entry => entry.contact_id);
                if (customFieldContacts.length > 0) {
                    orConditions.push({
                        _id: { $in: customFieldContacts.map(id => new ObjectId(id)) }
                    });
                }
            }
        }

        /*** 🗓️ Handle Date Filters (Project_date) ***/
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toISOString().split("T")[0];
        };

        if (startDate || endDate) {
            let dateFilter = {};
            if (startDate) dateFilter.$gte = formatDate(startDate);
            if (endDate) dateFilter.$lte = formatDate(endDate);

            query.$and = query.$and || [];
            query.$and.push({ Project_date: dateFilter });
        }

        if (orConditions.length > 0) {
            query.$or = orConditions;
        }

        /*** 🔽 Sorting ***/
        const sortOptions = {};

        // if (sortDate) {
        //     sortOptions.Project_date = sortDate.toLowerCase() === "desc" ? -1 : 1;
        // }

        if (sortName) {
            sortOptions.name = sortName.toLowerCase() === "desc" ? -1 : 1;
        }

        /*** 📦 Fetch Contacts ***/
        const totalContactsQuery = await Contacts.countDocuments(query);
        const contacts = await Contacts.find(query)
            .sort(sortOptions)
            .skip(limit == 0 ? 0 : skip)
            .limit(limit == 0 ? totalContactsQuery : Number(limit));

        if (!contacts.length) {
            //return res.status(404).json({ message: "No contacts found" });
        return res.status(200).json({
            contacts: {},
            page,
            limit,
            totalContacts: totalContactsQuery
        });
        }

        /*** 📋 Get Display Field Settings ***/
        const fieldNames = [
            "contact.cover_image",
            "contact.project_date",
            "contact.start_time",
            "contact.end_time",
            "contact.related_images"
        ];

        const customFields = allCustomFields.filter(field => fieldNames.includes(field.cf_key));
        const fieldMap = customFields.reduce((acc, field) => {
            acc[field.cf_key] = field.id;
            return acc;
        }, {});
        console.log(user_id)
        let settings;
        if (ObjectId.isValid(user_id)) {
            const stringId = user_id.toString(); // convert to string
            console.log(stringId)
            settings = await Settings.findOne({
                user_id: user_id, // using string in query (Mongoose may auto-cast)
                key: "displaySetting"
            });
            console.log(settings)
        } else {
            console.log("Invalid ObjectId format");
        }


        // if (!settings) return res.status(404).json({ message: "Display settings not found" });
        // console.log(settings);
        // const displayFields = settings.value;
        // const settingmapcfIds = [];

        // for (const field of displayFields) {
        //     const customField = allCustomFields.find(f => f.cf_id === field.cf_id);
        //     settingmapcfIds.push({
        //         ...field,
        //         cf_id: customField ? customField._id.toString() : field.cf_id
        //     });
        // }

        // const displayCfIds = displayFields.map(field => field.cf_id);
        // const selectedCustomFields = allCustomFields.filter(field =>
        //     displayCfIds.includes(field.cf_id)
        // );
        // const selectedCustomFieldIds = selectedCustomFields.map(field => field.id);

        // const contactIds = contacts.map(contact => contact.id);
        // const allCustomFieldIds = [
        //     ...customFields.map(field => field.id),
        //     ...selectedCustomFieldIds
        // ];

        // /*** 🧩 Fetch Custom Field Values for Contacts ***/
        // const allCustomFieldValues = await ContactCustomFields.find({
        //     contact_id: { $in: contactIds },
        //     custom_field_id: { $in: allCustomFieldIds }
        // });

        // const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
        //     if (!acc[field.contact_id]) acc[field.contact_id] = {};
        //     acc[field.contact_id][field.custom_field_id] = field.value || null;
        //     return acc;
        // }, {});
let settingmapcfIds = [];
        let selectedcustomFieldIds = [];
        if (settings && settings.value) {
            const displayFields = settings.value;
            for (const field of displayFields) {
                const customField = await CustomFields.findOne({ cf_id: field.cf_id });
                settingmapcfIds.push({
                    ...field,
                    cf_id: customField ? customField._id.toString() : field.cf_id
                });
            }
            const customFieldsid = await CustomFields.find({
                cf_id: { $in: displayFields.map(field => field.cf_id) }
            });
            selectedcustomFieldIds = customFieldsid.map(field => field.id);
        }
        const contactIds = contacts.map(contact => contact.id);
        const allCustomFieldIds = [...customFields.map(field => field.id), ...selectedcustomFieldIds];
        const allCustomFieldValues = await ContactCustomFields.find({
            contact_id: { $in: contactIds },
            custom_field_id: { $in: allCustomFieldIds }
        });
     
        const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
            if (!acc[field.contact_id]) acc[field.contact_id] = {};
            acc[field.contact_id][field.custom_field_id] = {
                value: field.value || null,
                cropedImage: field.cropedImage || null, // ✅ include this
            }    ;
            return acc;
        }, {});
        // const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
        //   if (!acc[field.contact_id]) acc[field.contact_id] = {};
        
        //   let value = field.value;
        
        //   if (Array.isArray(value)) {
        //     // Display array as comma-separated string or keep as-is
        //     value = value.join(', ');
        //   } else if (typeof value === 'object' && value !== null) {
        //     // Display object as JSON string (or extract useful parts)
        //     value = JSON.stringify(value); // or customize display here
        //   }
        
        //   acc[field.contact_id][field.custom_field_id] = value ?? null;
        //   return acc;
        // }, {});

        /*** 🧷 Format Final Output ***/
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

            Object.entries(fieldMap).forEach(([fieldKey, cfId]) => {
                const value = fieldValues[cfId] || null;

               if (fieldKey === "contact.cover_image") {
                    cardCoverImage = value;
                    coverImage = value;
                } else if (fieldKey === "contact.related_images") {
                    relatedImages = value || [];
                } else if (fieldKey === "contact.project_date") {
                    standardFields.projectDate = value;
                } else if (fieldKey === "contact.project_date" && !standardFields.projectDate) {
                    standardFields.projectDate = value;
                } else if (fieldKey === "contact.start_time") {
                    standardFields.startTime = value;
                } else if (fieldKey === "contact.end_time") {
                    standardFields.finishTime = value;
                }
            });

            customCustomFields = settingmapcfIds.map(({ cf_id, cf_name }) => ({
                label: cf_name,
                value: fieldValues[cf_id] || null
            }));

            return {
                basicContactData: {
                    id: contact.id,
                    contact_id: contact.contact_id,
                    location_id: contact.location_id,
                    name: contact.name || "No Name",
                    location: contact.location || null,
                    vendor: contact.vendor || null,
                    tags: Array.isArray(contact.tags)
                        ? contact.tags
                        : typeof contact.tags === "string"
                            ? contact.tags.split(",")
                            : [],
                    age: contact.age || null,
                    address: contact.address || null
                },
                cardCoverImage,
                standardCustomFields: standardFields,
                relatedImages,
                customCustomFields
            };
        });

        /*** 🧼 Final Sort by Project Date ***/
        if (sortDate) {
            formattedContacts.sort((a, b) => {
                const aDate = a.standardCustomFields?.projectDate
                    ? new Date(a.standardCustomFields.projectDate)
                    : null;
                const bDate = b.standardCustomFields?.projectDate
                    ? new Date(b.standardCustomFields.projectDate)
                    : null;

                if (!aDate && !bDate) return 0;
                if (!aDate) return 1;
                if (!bDate) return -1;

                return sortDate?.toLowerCase() === "asc" ? aDate - bDate : bDate - aDate;
            });
        }

        /*** ✅ Return Response ***/
        return res.status(200).json({
            contacts: formattedContacts,
            page,
            limit,
            totalContacts: totalContactsQuery
        });
    } catch (error) {
        console.error("Error fetching contacts:", error.message);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
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

        // Validate required params
        if (!contact_id) return res.status(400).json({ message: "contact_id is required" });
        if (!location_id) return res.status(400).json({ message: "location_id is required" });

        // Find the contact
        const contact = await Contacts.findOne({ contact_id, location_id });
        if (!contact) return res.status(404).json({ message: "Contact not found" });

        // Find user by location_id
        const user = await User.findOne({ location_id });
        if (!user) return res.status(404).json({ message: "No user found for the provided location_id" });

        const user_id = user._id;
        const allCustomFields = await CustomFields.find({ location_id });


        // Get standard field names
        const fieldNames = [
            "contact.cover_image",
            "contact.project_date",
            "contact.start_time",
            "contact.end_time",
            "contact.related_images"
        ];

        // Fetch custom fields from DB
        const customFields = allCustomFields.filter(field => fieldNames.includes(field.cf_key));
        const fieldMap = customFields.reduce((acc, field) => {
            acc[field.cf_key] = field.id;
            return acc;
        }, {});
        

        // Get display settings
        let settings = null;
        if (ObjectId.isValid(user_id)) {
            settings = await Settings.findOne({ user_id, key: "displaySetting" });
        } else {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        if (!settings) return res.status(404).json({ message: "Display settings not found" });

        const displayFields = settings.value || [];

        // Map display field cf_ids to actual _ids
        const settingmapcfIds = [];
        for (const field of displayFields) {
            const customField = await CustomFields.findOne({ cf_id: field.cf_id });
            settingmapcfIds.push({
                ...field,
                cf_id: customField ? customField._id.toString() : field.cf_id
            });
        }

        // Collect all relevant custom_field_ids
        const displayCfIds = displayFields.map(field => field.cf_id);
        const customFieldsFromDisplay = await CustomFields.find({ cf_id: { $in: displayCfIds } });

        const allCustomFieldIds = [
            ...customFields.map(f => f._id.toString()),
            ...customFieldsFromDisplay.map(f => f._id.toString())
        ];

        // Get custom field values for the contact
        const allCustomFieldValues = await ContactCustomFields.find({
            contact_id: contact._id.toString(),
            custom_field_id: { $in: allCustomFieldIds }
        });

        const contactFieldMap = allCustomFieldValues.reduce((acc, field) => {
            if (!acc[field.contact_id]) acc[field.contact_id] = {};
            acc[field.contact_id][field.custom_field_id] = field.value || null;
            return acc;
        }, {});

        const fieldValues = contactFieldMap[contact._id.toString()] || {};
        console.log("📦 fieldValues:", fieldValues);

        let standardFields = {
            projectDate: null,
            startTime: null,
            finishTime: null
        };
        let cardCoverImage = null;
        let relatedImages = [];
        let customCustomFields = [];

        Object.entries(fieldMap).forEach(([fieldKey, cfId]) => {
            const value = fieldValues[cfId] || null;

            if (fieldKey === "contact.cover_image") {
                cardCoverImage = value;
            } else if (fieldKey === "contact.related_images") {
                relatedImages = value || [];
            } else if (fieldKey === "contact.project_date") {
                standardFields.projectDate = value;
            } else if (fieldKey === "contact.project_date" && !standardFields.projectDate) {
                standardFields.projectDate = value;
            } else if (fieldKey === "contact.start_time") {
                standardFields.startTime = value;
            } else if (fieldKey === "contact.end_time") {
                standardFields.finishTime = value;
            }
        });

        // Display settings fields
        customCustomFields = settingmapcfIds.map(({ cf_id, cf_name }) => ({
            label: cf_name,
            value: fieldValues[cf_id] || null
        }));
      
        // Final formatted contact
        const formattedContact = {
            basicContactData: {
                id: contact._id.toString(),
                contact_id: contact.contact_id,
                location_id: contact.location_id,
                name: contact.name || "No Name",
                location: contact.location || null,
                vendor: contact.vendor || null,
                tags: Array.isArray(contact.tags)
                    ? contact.tags
                    : typeof contact.tags === "string"
                        ? contact.tags.split(",")
                        : [],
                age: contact.age || null,
                address: contact.address || null
            },
            cardCoverImage,
            standardCustomFields: standardFields,
            relatedImages,
            customCustomFields
        };

        return res.status(200).json({ contact: formattedContact });

    } catch (error) {
        console.error("❌ Error fetching single contact:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



module.exports = {
    getContactsWithCustomFields, getSingleContact
};
// if (projectDateField) {
//     const projectDateFieldId = projectDateField._id;
//     let dateFilterCondition = { custom_field_id: projectDateFieldId };

//     if (parsedStartDate && parsedEndDate) {
//         // If both dates exist, filter within range
//         dateFilterCondition.value = { $gte: parsedStartDate, $lte: parsedEndDate };
//     } else if (parsedStartDate) {
//         // If only startDate exists, filter for exact match
//         dateFilterCondition.value = parsedStartDate;
//     }

//     // Fetch contacts based on the Project Date filter
//     const dateFilteredContacts = await ContactCustomFields.find(dateFilterCondition);
//     console.log("Matching Contacts for Project Date:", dateFilteredContacts);

//     // Store matching contact IDs
//     const dateMatchedContactIds = dateFilteredContacts.map(entry => entry.contact_id);

//     if (dateMatchedContactIds.length > 0) {
//         orConditions.push({ _id: { $in: dateMatchedContactIds.map(id => new ObjectId(id)) } });
//     }
// } else {
//     console.error("No 'Project date' custom field found.");
// }
