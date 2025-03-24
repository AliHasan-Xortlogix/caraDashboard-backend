const ContactCustomFields = require('../models/ContactCutsomField.models');
const Tag = require("../models/tag");

exports.getSuggestion = async (req, res) => {

    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        // Fetch matching tags
        const tags = await Tag.find({
            name: { $regex: searchTerm, $options: 'i' }, // Case-insensitive regex search
        }).limit(5); // Limit results to 5 for performance

        // Fetch matching custom fields
        const customFields = await ContactCustomFields.find({
            fieldName: { $regex: searchTerm, $options: 'i' }, // Case-insensitive regex search
        }).limit(5); // Limit results to 5

        // Combine and send suggestions
        res.json({
            tags: tags.map(tag => tag.name),
            customFields: customFields.map(field => field.fieldName),
        });
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({ message: 'Error fetching search suggestions' });
    }
}