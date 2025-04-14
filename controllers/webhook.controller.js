const mongoose = require('mongoose');
const Contact = require('../models/Contact.models');
const Tag = require('../models/tag');
const ContactCustomField = require('../models/ContactCutsomField.models');
const customFieldModels = require('../models/customFields.models');
const User = require('../models/user.models');

exports.syncContact = async (req, res) => {
    const event = req.body;
console.log(event);
    const createContactData = (event) => {
        return new Contact({
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
        });
    };

    const handleCustomFields = async (event, contact, user) => {
        if (!event.customFields?.length) return;

        for (const field of event.customFields) {
            if (!field.id) continue;

            const fieldData = await customFieldModels.findOne({ cf_id: field.id });
            let value = typeof field.value === 'object' && field.value !== null
                ? Object.values(field.value)
                    .filter(v => v?.url)
                    .map(v => v.url)
                : field.value;
            console.log('Processed URL(s) from object value:', JSON.stringify(value, null, 2));
            // if (Array.isArray(value) && value.length === 1) value = value[0];

            if (fieldData) {
                if (fieldData.cf_key === 'contact.project_date') {
                    await Contact.findOneAndUpdate(
                        { contact_id: event.id },
                        { $set: { Project_date: new Date(value) } }
                    );
                }
                if (fieldData.cf_key === 'contact.cover_image') {
console.log(typeof value );
                    if (typeof value === 'object' && value !== null) {
                        try {
                            const parsed = JSON.parse(JSON.stringify(value, null, 2));
                            if (Array.isArray(parsed)) {
                                value = parsed[0];
                            }
                        } catch (err) {
                            console.error('Failed to stringify/parse value:', err);
                        }
                    }
                }
                await ContactCustomField.updateOne(
                    { contact_id: contact._id, custom_field_id: fieldData._id },
                    { value },
                    { upsert: true }
                );
            } else {
                if (customFieldData.cf_key === 'contact.project_date') {
                    console.log('Project Date:', extractedUrls);
                    await Contact.findOneAndUpdate(
                        { contact_id: event.id },
                        { $set: { Project_date: new Date(extractedUrls) } },
                        { new: true }
                    );
                }
                if (fieldData.cf_key === 'cover_image') {
                    if (typeof value === 'object' && value !== null) {
                        try {
                            const parsed = JSON.parse(JSON.stringify(value, null, 2));
                            if (Array.isArray(parsed)) {
                                value = parsed[0];
                            }
                        } catch (err) {
                            console.error('Failed to stringify/parse value:', err);
                        }
                    }
                }   
                    const newCustomField = new ContactCustomField({
                    user_id: user._id,
                    contact_id: contact._id,
                    custom_field_id: field.id,
                    value,
                });
                await newCustomField.save();
            }
        }
    };

    const handleTags = async (event, contact, user) => {
        if (!event.tags?.length) return;

        for (const tagName of event.tags) {
            const trimmed = tagName.trim();
            let tag = await Tag.findOne({
                name: trimmed,
                user_id: user._id,
                location_id: event.locationId || null,
            });

            if (!tag) {
                tag = await Tag.create({
                    name: trimmed,
                    location_id: event.locationId,
                    user_id: user._id,
                });
            }
        }

        await contact.save();
    };

    try {
        const user = await User.findOne({ location_id: event.locationId });
        if (!user) {
            return res.status(400).json({ error: `User not found for location_id: ${event.locationId}` });
        }

        let contact;

        if (event.type === 'ContactCreate') {
            const newContact = createContactData(event);
            contact = await newContact.save();
        }

        if (event.type === 'ContactUpdate') {
            contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }
            const updated = createContactData(event);
            const { _id, ...updates } = updated.toObject();
            await Contact.findByIdAndUpdate(contact._id, updates);
        }

        if (event.type === 'ContactTagUpdate') {
            contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }
        }

        if (contact) {
            await handleCustomFields(event, contact, user);
            await handleTags(event, contact, user);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error syncing contact:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
