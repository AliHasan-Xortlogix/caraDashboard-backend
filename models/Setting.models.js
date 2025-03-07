// models/Settings.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const settingsSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,  // Assuming user_id is referencing a User model
ref: 'User',
        required: true,
    },
    key: {
        type: String,
        required: true,
    },
    value: {
        type: String,  // or use Schema.Types.Mixed if value can have various types
        required: false,
    },  created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true,  
});

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
