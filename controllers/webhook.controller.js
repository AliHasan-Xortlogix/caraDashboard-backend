const mongoose = require('mongoose');
const Contact = require('../models/Contact.models');
const Tag = require('../models/tag');
const ContactCustomField = require('../models/ContactCutsomField.models');
const customFieldModels = require('../models/customFields.models');
const User = require('../models/user.models');

exports.syncContact = async (req, res) => {
    const event = req.body;

    // Shared builder function to construct contact data for creation/updating
    function buildContactData(event) {
        return {
            location_id: event.locationId || null,
            contact_id: event.id || null,
            name: `${event.firstName} ${event.lastName}`.trim() || null,
            email: event.email?.trim() || null,
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
        };
    }

    async function handleCustomFields(event, contact, user) {
        if (!event.customFields || event.customFields.length === 0) return;

        for (const customField of event.customFields) {
            if (!customField.id) {
                console.error('Invalid custom field ID:', customField.id);
                continue;
            }

            const customFieldData = await customFieldModels.findOne({ cf_id: customField.id });
            let extractedValue;

            if (typeof customField.value === "object" && customField.value !== null) {
                const urls = Object.values(customField.value)
                    .filter(item => item && typeof item === "object" && item.url)
                    .map(item => item.url);
                extractedValue = urls.length === 1 ? urls[0] : urls;
            } else {
                extractedValue = customField.value;
            }

            if (customFieldData) {
                if (customFieldData.cf_name === 'Project Date') {
                    await Contact.findOneAndUpdate(
                        { contact_id: event.id },
                        { $set: { Project_date: new Date(extractedValue) } },
                        { new: true }
                    );
                }

                await ContactCustomField.updateOne(
                    { contact_id: contact._id, custom_field_id: customFieldData._id },
                    { value: extractedValue },
                    { upsert: true }
                );
            } else {
                const newCustomField = new ContactCustomField({
                    user_id: user._id,
                    contact_id: contact._id,
                    custom_field_id: customField.id,
                    value: extractedValue,
                });

                await newCustomField.save();
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
            }

            tagIds.push(tag._id);
        }

        await contact.save();
    }

    try {
        const user = await User.findOne({ location_id: event.locationId });
        if (!user) {
            return res.status(400).json({ error: `User not found for location_id: ${event.locationId}` });
        }

        // Handle ContactCreate
        if (event.type === 'ContactCreate') {
            const newContactData = buildContactData(event);
            const newContact = new Contact(newContactData);
            await newContact.save();
            await handleCustomFields(event, newContact, user);
            await handleTags(event, newContact, user);
        }

        // Handle ContactUpdate
        if (event.type === 'ContactUpdate') {
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }

            const updatedContactData = buildContactData(event);
            await Contact.updateOne({ contact_id: event.id }, { $set: updatedContactData });
            await handleCustomFields(event, contact, user);
            await handleTags(event, contact, user);
        }

        // Handle ContactTagUpdate
        if (event.type === 'ContactTagUpdate') {
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }

            const tagNames = [];

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
                }

                if (!tagNames.includes(trimmedTagName)) {
                    tagNames.push(trimmedTagName);
                }
            }

            const tagNamesString = tagNames.join(', ');
            await Contact.updateOne(
                { _id: contact._id },
                { $set: { tags: tagNamesString } }
            );
        }

        res.status(200).json({ message: "Contact sync complete." });

    } catch (error) {
        console.error('Error syncing contact:', error);
        return res.status(500).json({ error: `Error syncing contact: ${error.message}` });
    }
};
