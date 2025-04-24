// controllers/imageController.js
const fs = require("fs");
const path = require("path");
const Contact = require("../models/Contact.models");
const CustomField = require("../models/customFields.models");
const ContactCustomField = require("../models/ContactCutsomField.models");

exports.uploadCropped = async (req, res) => {
    try {
        const { contactId } = req.body;
        console.log("hi")
        const filename = req?.file?.filename;
        if (!contactId || !filename) {
            return res.status(400).json({ message: "Missing contact ID or file" });
        }

        const [contact] = await Promise.all([
            Contact.findOne({ _id: contactId })
        ]);
        console.log([contact])
        if (!contact) return res.status(404).json({ message: "Contact not found" });

        const customField = await CustomField.findOne({
            cf_key: 'contact.cover_image',
            location_id: contact.location_id,
        });

        if (!customField) return res.status(404).json({ message: "CustomField not found" });

        const filter = {
            contact_id: contact._id,
            custom_field_id: customField._id,
        };

        const croppedImagePath = `http://localhost:5000/api/v1/uploads/${filename}`;
        const fullImagePath = path.join(__dirname, "..", "public", "uploads", filename);

        const existingEntry = await ContactCustomField.findOne(filter);

        // Delete previous image if it exists
        if (existingEntry?.cropedImage) {
            const oldPath = path.join(__dirname, "..", "public", existingEntry.cropedImage);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        console.log(croppedImagePath)
        // Update or insert the new image
        const updateResult = await ContactCustomField.findOneAndUpdate(
            filter ,
            { cropedImage: croppedImagePath },
            { upsert: true, new: true } // ✅ important
        );
        console.log(updateResult)
        res.status(200).json({
            message: "Image uploaded and linked successfully",
            imageUrl: croppedImagePath,
            updatedField: updateResult,
        });
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ message: "Server error while uploading image" });
    }
};
