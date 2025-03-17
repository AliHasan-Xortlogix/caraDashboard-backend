const mongoose = require("mongoose");

const ContactCustomFieldSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Foreign key reference to User
    contact_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    }, // Foreign key reference to Contact
    custom_field_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomField",
      default: null,
    }, // Foreign key reference to CustomField
    value: { type: String, default: null }, // Stores custom field value
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactCustomField", ContactCustomFieldSchema);
