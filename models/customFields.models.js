const mongoose = require("mongoose");

const CustomFieldSchema = new mongoose.Schema(
    {
        cf_id: { type: String },
        cf_name: { type: String},
        cf_key: { type: String },
        dataType: { type: String },
        location_id: { type: String },
        user_id: {
            type: String,
            ref: "User",
           
        }, 
    },
    { timestamps: true }
);

module.exports = mongoose.model("CustomField", CustomFieldSchema);
