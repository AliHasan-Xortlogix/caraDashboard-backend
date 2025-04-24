const mongoose = require("mongoose");
const { Schema } = mongoose;
const ContactCustomFieldSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      ref: "User",
      default: null,
    }, // Foreign key reference to User
    contact_id: {
      type: String,
      ref: "Contact",
      default: null,
    }, // Foreign key reference to Contact
    custom_field_id: {
      type: String,
      ref: "CustomField",
      default: null,
    }, 
    cropedImage:{
      type:String,
      default:null,
    },
    value: { type: Schema.Types.Mixed, default: null }, // Stores custom field value
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactCustomField", ContactCustomFieldSchema);
