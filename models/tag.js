const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema(
  {
    location_id: { type: String, }, 
    name: { type: String, }, 
    user_id: {
      type: String,
      ref: "User",

    }, 
  },
  { timestamps: true }
); 

module.exports = mongoose.model("Tag", TagSchema);

