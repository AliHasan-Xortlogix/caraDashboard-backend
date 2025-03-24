const Customfields = require('../models/customFields.models');
const Tag = require("../models/tag");

exports.getSuggestion = async (req, res) => {
    const searchTerm = req.query.q?.trim(); // Trim spaces

    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        console.log(`Searching for: "${searchTerm}"`);

        // Create the search regex
        const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        console.log(`Search Regex: ${searchRegex}`);

        // Fetch matching tags (Case-insensitive & partial match)
        const tags = await Tag.find({ name: searchRegex }).limit(5);
        console.log(`Tags Found:`, tags);

        // Fetch matching custom fields (using regex for partial match)
        const customFields = await Customfields.find({
            cf_name: searchRegex, // Ensure you're using the regex for partial matches
        }).limit(5);
        console.log(`Custom Fields Found:`, customFields);

        const response = {
           ...tags.map(tag => tag.name), // Extract tag names
            ...customFields.map(field => field.cf_name),
        };

        if (response.tags.length === 0 && response.customFields.length === 0) {
            return res.status(404).json({ message: 'No matching data found' });
        }

        return res.json(response);

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        return res.status(500).json({ message: 'Error fetching search suggestions', error: error.message });
    }
};

