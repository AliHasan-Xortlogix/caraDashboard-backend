const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema(
  {
    location_id: { type: String, }, // Nullable string field
    name: { type: String, }, // Tag name
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",

    }, // Reference to User model
  },
  { timestamps: true }
); // Automatically adds createdAt and updatedAt fields

module.exports = mongoose.model("Tag", TagSchema);

