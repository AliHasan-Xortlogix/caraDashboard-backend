const Customfields = require('../models/ContactCutsomField.models');
const Tag = require("../models/tag");



exports.getSuggestion = async (req, res) => {
    const searchTerm = req.query.q?.trim(); // Trim spaces

    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        console.log(`Searching for: "${searchTerm}"`);

        // Fetch matching tags (Case-insensitive & partial match)
        const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        console.log(searchRegex)
        const tags = await Tag.find({ name: searchRegex }).limit(5);

        console.log(`Tags Found:`, tags);

       
        const customFields = await Customfields.find({
            cf_name: searchTerm,
        }).limit(5);

        console.log(`Custom Fields Found:`, customFields);

        // Combine both results into one object
        const response = {
            tags: tags.map(tag => tag.name),
            customFields: customFields.map(field => field.cf_name),
        };

        // Check if either tags or customFields has results
        if (response.tags.length === 0 && response.customFields.length === 0) {
            return res.status(404).json({ message: 'No matching data found' });
        }

        // Send combined results
        res.json(response);

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({ message: 'Error fetching search suggestions' });
    }
};


