const mongoose = require("mongoose");

const DisplaySettingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true },  
        value: {
            type: Map,  
            of: mongoose.Schema.Types.Mixed,  
            required: true
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,  
            ref: "User",
            required: true
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("DisplaySetting", DisplaySettingSchema);
