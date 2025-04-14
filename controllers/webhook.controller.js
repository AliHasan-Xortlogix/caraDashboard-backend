const mongoose = require('mongoose');
const Contact = require('../models/Contact.models');
const Tag = require('../models/tag');
const ContactCustomField = require('../models/ContactCutsomField.models');
const customFieldModels = require('../models/customFields.models');
const User = require('../models/user.models');
const winston = require('winston');

// Set up Winston logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(), // Log to console
        new winston.transports.File({ filename: 'app.log' }) // Log to a file
    ]
});

exports.syncContact = async (req, res) => {
    const event = req.body;

    function contactCreateData(event) {
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
                logger.error('Invalid ObjectId for custom field ID:', customField.id);
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

            logger.info('Extracted custom field value:', extractedUrls);

            if (customFieldData) {
                if (customFieldData.cf_name == 'Project Date') {
                    logger.info('Project Date:', extractedUrls);
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
                    logger.info('New custom field created for contact:', contact._id);
                }
            } else {
                if (customFieldData.cf_name == 'Project Date') {
                    logger.info('Project Date:', extractedUrls);
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
                logger.info('New custom field added to contact:', contact._id);
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
                logger.info('Created new tag:', trimmedTagName);
            } else {
                logger.info('Tag already exists:', trimmedTagName);
            }

            tagIds.push(tag._id);
        }

        await contact.save();
        logger.info('Tags updated for contact:', contact._id);
    }

    try {
        const user = await User.findOne({ location_id: event.locationId });
        if (!user) {
            logger.error('User not found for location_id:', event.locationId);
            return res.status(400).json({ error: `User not found for location_id: ${event.locationId}` });
        }

        if (event.type === 'ContactCreate') {
            logger.info('Processing ContactCreate event');
            let newContact = contactCreateData(event);
            await newContact.save();
            await handleCustomFields(event, newContact, user);
            await handleTags(event, newContact, user);
        }

        if (event.type === 'ContactUpdate') {
                        // const contact = await Contact.findOne({ contact_id: event.id });
            // if (!contact) {
            //     logger.error('Contact not found for ID:', event.id);
            //     return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            // }
            // const updatedContact = contactCreateData(event);
            // await Contact.updateOne({ contact_id: event.id }, updatedContact);
            const updatedContact = contactCreateData(event);
            await Contact.findOneAndUpdate(
                { contact_id: event.id },
                { $set: updatedContact },
                { new: true }
            );
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                logger.error('Contact not found for ID:', event.id);
                return res.status(404).json({ error: `Contact not found for ID: ${event.id}` });
            }

            await handleCustomFields(event, contact, user);
            await handleTags(event, contact, user);
        }

        if (event.type === 'ContactTagUpdate') {
            const contact = await Contact.findOne({ contact_id: event.id });
            if (!contact) {
                logger.error('Contact not found for ID:', event.id);
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
                    logger.info('Created new tag:', trimmedTagName);
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
            logger.info(`Associated tags with contact: ${tagNamesString}`);
        }

        res.status(200).json({ message: "Contact sync complete." });

    } catch (error) {
        logger.error('Error syncing contact:', error);
        return res.status(500).json({ error: `Error syncing contact: ${error.message}` });
    }
};
