const mongoose = require("mongoose");

const FilterSettingSchema = new mongoose.Schema(
    {
        key: { type: String, }, 
        value: { type: String, },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",

        },
    },
    { timestamps: true }
); 

module.exports = mongoose.model("FilterSetting", FilterSettingSchema);
