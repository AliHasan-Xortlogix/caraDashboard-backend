const mongoose = require('mongoose');
const Contact = require('../models/Contact.models');
const Tag = require('../models/tag');
const ContactCustomField = require('../models/ContactCutsomField.models');
const customFieldModels = require('../models/customFields.models');
const User = require('../models/user.models');

exports.syncContact = async (req, res) => { // Pass res as a parameter
    const event = req.body;
    function contactCreateData(event) {

        // Create the contact
        let createData = new Contact({
            location_id: event.locationId || null,
            contact_id: event.id || null,
            name: `${event.firstName} ${event.lastName}` || null,
            email: event.email.trim() || null,
            phone: event.phone || null,
            address: event.address_1 || null,
            profile_image: event.profilePhoto || null,
            city: event.city || null,
            state: event.state || null,
            country: event.country || null,
            company: event.companyName || null,
            website: event.website || null,
            source: event.source || null,
            custom_fields: event.customFields,
            type: event.type || null,
            assigned_to: event.assignedTo || null,
            followers: event.followers ? JSON.stringify(event.followers) : null,
            additional_emails: event.additionalEmails ? JSON.stringify(event.additionalEmails) : null,
            attributions: event.attributions ? JSON.stringify(event.attributions) : null,
            dnd: event.dnd || false,
            dnd_settings_email: event.dndSettings?.email || null,
            dnd_settings_sms: event.dndSettings?.sms || null,
            dnd_settings_call: event.dndSettings?.call || null,
            date_added: event.dateAdded ? new Date(event.dateAdded) : null,
            date_updated: event.dateUpdated ? new Date(event.dateUpdated) : null,
            date_of_birth: event.dateOfBirth ? new Date(event.dateOfBirth) : null,
        });
        return createData;
    }
    async function handleCustomFields(event, contact, user) {
        if (!event.customFields || event.customFields.length === 0) return;

        for (const customField of event.customFields) {
            if (!customField.id) {
                console.error('Invalid ObjectId for custom field ID:', customField.id);
                continue;
            }

            const customFieldData = await customFieldModels.findOne({ cf_id: customField.id });
            let extractedUrls;

            if (typeof customField.value === "object" && customField.value !== null) {
                extractedUrls = Object.values(customField.value)
                    .filter(item => item && typeof item === "object" && item.url)
                    .map(item => item.url);
                extractedUrls = extractedUrls.length === 1 ? extractedUrls[0] : extractedUrls;
            } else {
                extractedUrls = customField.value;
            }

            console.log('Extracted custom field value:', extractedUrls);

            if (customFieldData) {
                if (customFieldData.cf_name == 'Project Date') {
                    console.log('Project Date:', extractedUrls);
                    await Contact.findOneAndUpdate(
                        { contact_id: event.id },
                        { $set: { Project_date: new Date(extractedUrls) } },
                        { new: true }
                    );
                }
                const updateResult = await ContactCustomField.updateOne(
                    { contact_id: contact._id, custom_field_id: customFieldData._id },
                    { value: extractedUrls },
                    { upsert: true }
                );

                if (updateResult.upsertedCount > 0) {
                    console.log('New custom field created for contact:', contact._id);
                }
            } else {
                if (customFieldData.cf_name == 'Project Date') {
                    console.log('Project Date:', extractedUrls);
                    await Contact.findOneAndUpdate(
                        { contact_id: event.id },
                        { $set: { Project_date: new Date(extractedUrls) } },
                        { new: true }
                    );
                }
                const newCustomField = new ContactCustomField({
                    user_id: user._id,
                    contact_id: contact._id,
                    custom_field_id: customField.id,
                    value: extractedUrls,
                });

                await newCustomField.save();
                console.log('New custom field added to contact:', contact._id);
            }
        }
    }

    async function handleTags(event, contact, user) {
        if (!event.tags || event.tags.length === 0) return;

        const tagIds = [];

        for (const tagName of event.tags) {
            const trimmedTagName = tagName.trim();
            let tag = await Tag.findOne({
                name: trimmedTagName,
                user_id: user._id,
                location_id: event.locationId || null,
            });

            if (!tag) {
                tag = await Tag.create({
                    name: trimmedTagName,
                    location_id: event.locationId,
                    user_id: user._id,
                });
                console.log('Created new tag:', trimmedTagName);
            } else {
                console.log('Tag already exists:', trimmedTagName);
            }

            tagIds.push(tag._id);
        }

        await contact.save();
        console.log('Tags updated for contact:', contact._id);
    }
    try {
        // Ensure the user exists for the given location_id
        const user = await User.findOne({ location_id: event.locationId });
        if (!user) {
            console.error('User not found for location_id:', event.locationId);
            return res.status(400).json({ error: `User not found for location_id: ${event.locationId}` });
        }

        // Handle ContactCreate
        if (event.type === 'ContactCreate') {
            console.log(event.type === 'ContactCreate')
            let newContact = contactCreateData(event);
            await newContact.save();
            await handleCustomFields(event, newContact, user);
            await handleTags(event, newContact, user);

        }

        // Handle ContactUpdate
        if (event.type === 'ContactUpdate') {
            console.log(event);
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                console.error('Contact not found for ID:', event.id);
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }
            // Prepare updated contact details
            const updatedContact = contactCreateData(event);
            // Update the contact
            const { _id, ...safeToUpdate } = updatedContact;
            await Contact.findByIdAndUpdate(contact._id, safeToUpdate);

            await handleCustomFields(event, contact, user);
            await handleTags(event, contact, user);
        }


        // Handle ContactTagUpdate
        if (event.type === 'ContactTagUpdate') {
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                console.error('Contact not found for ID:', event.id);
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }

            // Create an array to hold all the tag names
            const tagNames = [];

            // Loop through each tag name in the event
            for (const tagName of event.tags) {
                const trimmedTagName = tagName.trim();

                // Try to find the tag by name, user_id, and location_id
                let tag = await Tag.findOne({
                    name: trimmedTagName,
                    user_id: user._id,
                    location_id: event.locationId || null,
                });

                if (!tag) {
                    // If the tag does not exist, create a new one
                    tag = await Tag.create({
                        name: trimmedTagName,
                        location_id: event.locationId,
                        user_id: user._id,
                    });
                    console.log('Created new tag:', trimmedTagName);
                } else {
                    console.log('Tag already exists:', trimmedTagName);
                }

                // Add the tag name to the tagNames array if the tag doesn't already exist
                if (!tagNames.includes(trimmedTagName)) {
                    tagNames.push(trimmedTagName);
                }
            }


            // Convert the array of tag names into a single string with commas
            const tagNamesString = tagNames.join(', ');  // Convert array to string

            // Update the contact with the concatenated tag names string
            await Contact.updateOne(
                { _id: contact._id },
                { $set: { tags: tagNamesString } } // Store the string of tags instead of an array
            );
            console.log(`Associated tags with contact: ${tagNamesString}`);
        }
        // Respond with a success message
        res.status(200).json({ message: "Contact sync complete." });

    } catch (error) {
        console.error('Error syncing contact:', error);
        return res.status(500).json({ error: `Error syncing contact: ${error.message}` });
    }
};
