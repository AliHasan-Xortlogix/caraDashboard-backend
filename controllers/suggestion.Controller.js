const Customfields = require('../models/customFields.models');
const Tag = require("../models/tag");
const Contacts = require('../models/Contact.models'); // Assuming the model for Contactk is available
const User = require('../models/user.models');
exports.getSuggestion = async (req, res) => {
    const searchTerm = req.query.q?.trim();
    const user_id = req.user._id;

    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const user = await User.findById(user_id).select("location_id");
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const locationId = user.location_id;
        console.log(`User Location ID: ${locationId}`);

        const [tags, customFields, contacts] = await Promise.all([
            Tag.find({ name: searchRegex, location_id: locationId }).limit(5),
            Customfields.find({ cf_name: searchRegex, location_id: locationId }).limit(5),
            Contacts.find({ name: searchRegex, location_id: locationId }).limit(5)
        ]);

        const suggestions = [
            ...tags.map(tag => tag.name),
            ...customFields.map(field => field.cf_name),
            ...contacts.map(contact => contact.name)
        ];

        if (suggestions.length === 0) {
            return res.status(404).json({ message: 'No matching data found' });
        }

        return res.json({ suggestions });

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
