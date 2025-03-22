// models/Settings.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const settingsSchema = new Schema({
    user_id: {
        type:mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
    },
    key: {
        type: String,
        required: true,
    },
    value: {
        type: Schema.Types.Mixed,
        required: false,
    }, created_at: {
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
