const Customfields = require('../models/customFields.models');
const Tag = require("../models/tag");
const Contactk = require('../models/contactk'); // Assuming the model for Contactk is available

exports.getSuggestion = async (req, res) => {
    const searchTerm = req.query.q?.trim(); // Trim spaces

    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        console.log(`Searching for: "${searchTerm}"`);

        // Create the search regex for case-insensitive partial matching
        const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        console.log(`Search Regex: ${searchRegex}`);

        // Fetch matching tags (case-insensitive & partial match)
        const tags = await Tag.find({ name: searchRegex }).limit(5);
        console.log(`Tags Found:`, tags);

        // Fetch matching custom fields (case-insensitive & partial match)
        const customFields = await Customfields.find({
            cf_name: searchRegex,
        }).limit(5);
        console.log(`Custom Fields Found:`, customFields);

        // Fetch matching contactk records (case-insensitive & partial match)
        const contactkResults = await Contactk.find({
            name: searchRegex
        }).limit(5);
        console.log(`Contactk Results Found:`, contactkResults);

        // Ensure that tags, customFields, and contactkResults are always arrays
        const combinedResults = [
            ...(tags || []).map(tag => tag.name), // Use an empty array if tags is undefined
            ...(customFields || []).map(field => field.cf_name), // Use an empty array if customFields is undefined
            ...(contactkResults || []).map(contact => contact.name) // Use an empty array if contactkResults is undefined
        ];

        // If there are no results for tags, customFields, or contactkResults
        if (combinedResults.length === 0) {
            return res.status(404).json({ message: 'No matching data found' });
        }

        // Send the combined results in the response
        return res.json({ suggestions: combinedResults });

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        return res.status(500).json({ message: 'Error fetching search suggestions', error: error.message });
    }
};
