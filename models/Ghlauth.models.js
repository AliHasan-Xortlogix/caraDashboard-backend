
const mongoose = require('mongoose');

// Define the Token Schema
const tokenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    user_type: {
        type: String,
        required: true
    },
    access_token: {
        type: String,
        required: true
    },
    refresh_token: {
        type: String,
        required: true
    },
    company_id: {
        type: String,
        required: true
    },
    location_id: {
        type: String,
        required: true
    },
    expires_at: {
        type: Date,
        required: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt:true } 
});

// Create the Token model using the schema
const Token = mongoose.model('Token', tokenSchema);

// Export the Token model
module.exports = Token;
