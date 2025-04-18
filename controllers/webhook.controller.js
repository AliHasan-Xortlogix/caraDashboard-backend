const mongoose = require("mongoose");
const Contact = require("../models/Contact.models");
const Tag = require("../models/tag");
const ContactCustomField = require("../models/ContactCutsomField.models");
const customFieldModels = require("../models/customFields.models");
const User = require("../models/user.models");
const Ghlauth = require("../models/Ghlauth.models");
const axios = require("axios");
const moment = require("moment-timezone");
const CRM = require('../utils/Crm.auto');
exports.syncContact = async (req, res) => {
  const event = req.body;
console.log("webhook" ,event)
  const createContactData = (event) => {
    return new Contact({
      location_id: event.locationId || null,
      contact_id: event.id || null,
      name: `${event.firstName} ${event.lastName}`.trim() || null,
      email: event.email?.trim() || null,
      phone: event.phone || null,
      address: event.address1 || null,
      profile_image: event.profilePhoto || null,
      city: event.city || null,
      tags: event.tags?.join(",") || null,
      state: event.state || null,
      country: event.country || null,
      company: event.companyName || null,
      website: event.website || null,
      source: event.source || null,
      custom_fields: event.customFields,
      type: event.type || null,
      assigned_to: event.assignedTo || null,
      followers: event.followers ? JSON.stringify(event.followers) : null,
      additional_emails: event.additionalEmails
        ? JSON.stringify(event.additionalEmails)
        : null,
      attributions: event.attributions
        ? JSON.stringify(event.attributions)
        : null,
      dnd: event.dnd || false,
      dnd_settings_email: event.dndSettings?.email || null,
      dnd_settings_sms: event.dndSettings?.sms || null,
      dnd_settings_call: event.dndSettings?.call || null,
      date_added: event.dateAdded ? new Date(event.dateAdded) : null,
      date_updated: event.dateUpdated ? new Date(event.dateUpdated) : null,
      date_of_birth: event.dateOfBirth ? new Date(event.dateOfBirth) : null,
    });
  };

  const getCustomFieldsFromGHL = async (
    locationId,
    accessToken,
    customfieldId
  ) => {
    try {
      const response = await axios.get(
        `https://services.leadconnectorhq.com/locations/${locationId}/customFields/${customfieldId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Version: "2021-07-28",
          },
        }
      );

      if (response.status === 200 && response.data?.customField) {
        return response.data.customField;
      } else {
        console.log("No Data Success Found");
        return { message: "No data found" };
      }
    } catch (error) {
      console.error(
        "Error fetching custom fields from GHL:",
        error.response?.data || error.message
      );
      return { message: "No data found" };
    }
  };

  const storeCustomFields = async (customFields, locationId, userId) => {
    try {
      const field = customFields;
      if (field.id) {
        const existingField = await customFieldModels.findOne({
          user_id: userId,
          cf_id: field.id,
          location_id: locationId,
        });

        if (existingField) {
          existingField.cf_name = field.name;
          existingField.cf_key = field.fieldKey;
          existingField.dataType = field.dataType;
          await existingField.save();
          console.log(`Custom field with id ${field.id} updated`);
        } else {
          const newCustomField = new customFieldModels({
            cf_id: field.id,
            cf_name: field.name,
            cf_key: field.fieldKey,
            dataType: field.dataType,
            location_id: locationId,
            user_id: userId,
          });
          await newCustomField.save();
          console.log(`Custom field with id ${field.id} created`);
        }
      }
      console.log("Custom fields successfully processed");
    } catch (error) {
      console.error("Error saving custom fields:", error);
      throw new Error("Failed to save custom fields");
    }
  };

  const handleCustomFields = async (event, contact, user) => {
    if (!event.customFields?.length) return;
  await ContactCustomField.deleteMany({ contact_id: contact._id });
    for (const field of event.customFields) {
      if (!field.id) continue;
  // Step 1: Delete all existing custom fields for this contact

      let fieldData = await customFieldModels.findOne({ cf_id: field.id });
if(typeof field.value == "array" ){
JSON.stringify(field.value);
}
      let value =
        typeof field.value === "object" && field.value !== null
          ? Object.values(field.value)
              .filter((v) => v?.url && !v.meta?.deleted)
              .map((v) => v.url)
          : field.value;

      console.log(
        "Processed URL(s) from object value:",
        JSON.stringify(value, null, 2)
      );

      if (fieldData) {
        if (fieldData.cf_key === "contact.project_date") {
          await Contact.findOneAndUpdate(
            { contact_id: event.id },
            { $set: { Project_date: new Date(value) } }
          );
        }

        await ContactCustomField.updateOne(
          { contact_id: contact._id, custom_field_id: fieldData._id },
          { value },
          { upsert: true }
        );
      } else {
        const userRecord = await User.findById(user._id);
        const locationId = userRecord.location_id;

        const ghlauthRecord = await Ghlauth.findOne({
          location_id: locationId,
        });
        if (!ghlauthRecord || !ghlauthRecord.access_token) {
          return res
            .status(400)
            .json({ error: "Access token not found for this location" });
        }
        const accessToken = ghlauthRecord.access_token;

        const customField = await getCustomFieldsFromGHL(
          locationId,
          accessToken,
          field.id
        );
        if (customField.id) {
          await storeCustomFields(customField, locationId, user._id);

          fieldData = await customFieldModels.findOne({ cf_id: field.id });

          if (fieldData) {
            const newCustomField = new ContactCustomField({
              user_id: user._id,
              contact_id: contact._id,
              custom_field_id: fieldData._id,
              value,
            });
            await newCustomField.save();
          }
        }
      }
    }
  };

  const handleTags = async (event, contact, user) => {
    if (!event.tags?.length) return;

    for (const tagName of event.tags) {
      const trimmed = tagName.trim();
      let tag = await Tag.findOne({
        name: trimmed,
        user_id: user._id,
        location_id: event.locationId || null,
      });

      if (!tag) {
        tag = await Tag.create({
          name: trimmed,
          location_id: event.locationId,
          user_id: user._id,
        });
      }
    }

    await contact.save();
  };
  try {
    const user = await User.findOne({ location_id: event.locationId });
    if (!user) {
      return res
        .status(400)
        .json({ error: `User not found for location_id: ${event.locationId}` });
    }

    let contact;
    let newContact;

    if (event.type === "ContactCreate") {
      if (event.locationId === user.location_id) {
        if (
          !Array.isArray(event.tags) ||
          !event.tags.includes("show in gallery")
        ) {
          return res
            .status(400)
            .json({ error: `Desired Tag Not Found : ${event.id}` });
        }
        console.log(event.type);
        newContact = createContactData(event);
        contact = await newContact.save();
      }
    }

    if (["ContactUpdate", "ContactTagUpdate"].includes(event.type)) {
      if (event.locationId === user.location_id) {
        if (
          !Array.isArray(event.tags) ||
          !event.tags.includes("show in gallery")
        ) {
          return res
            .status(400)
            .json({ error: `Desired Tag Not Found : ${event.id}` });
        }

        contact = await Contact.findOne({ contact_id: event.id });

        if (!contact) {
          newContact = createContactData(event);
          contact = await newContact.save();
        }

        const updated = createContactData(event);
        const { _id, ...updates } = updated.toObject();
        await Contact.findByIdAndUpdate(contact._id, updates);
      }
    }

    if (contact && event.locationId === user.location_id) {
      await handleCustomFields(event, contact, user);
      await handleTags(event, contact, user);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error syncing contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.createAppointment = async (req, res) => {
        const makeAppointmentCall = async (payload, accessToken,user) => {
            try {
                // const response = await axios.post(
                //     "https://services.leadconnectorhq.com/calendars/events/appointments",
                //     payload,
                //     {
                //         headers: {
                //             Authorization: `Bearer ${accessToken}`,
                //             Version: "2021-07-28",
                //             "Content-Type": "application/json",
                //         },
                //     }
                // );
                let responseghl=await CRM.crmV2(user._id,`calendars/events/appointments`,'post',payload);
                console.log("Appointment Response:", responseghl);
                // Check for `id` in response
                if (responseghl &&  responseghl.id) {
                    return {
                        appointmentCreation: true,
                        rejectionTag: false,
                    };
                } else {
                    return {
                        appointmentCreation: false,
                        rejectionTag: true,
                    };
                }
    
            } catch (error) {
                console.error('Error creating appointment:', error.response?.data || error.message);
                throw new Error('Failed to create appointment');
            }
        };

    try {
        const {
            data,
            extras
        } = req.body;

        const {
            start_date,
            start_time = "09:00AM", // fallback default
            end_date,
            end_time = "10:00AM",   // fallback default
            time_zone = "Australia/Sydney", // Convert "AEST" → "Australia/Sydney"
            calendar_id,
            user_id,
            rejection_tag
        } = data;

        const {
            locationId,
            contactId,
        } = extras;

        // 🧠 Parse date in format "April 1, 2025"
        const parsedStart = moment.tz(`${start_date} ${start_time}`, "MMMM D, YYYY hh:mmA", time_zone).format();
        const parsedEnd = moment.tz(`${end_date} ${end_time}`, "MMMM D, YYYY hh:mmA", time_zone).format();

        // Prepare payload
        const payload = {
            title: "Test Event",
            ignoreDateRange: false,
            ignoreFreeSlotValidation: true,
            assignedUserId: user_id,
            calendarId: calendar_id,
            locationId: locationId,
            contactId: contactId,
            startTime: parsedStart,
            endTime: parsedEnd,
        };
        console.log(payload);
        // Fetch token
        const user = await User.findOne({ location_id: locationId });
        if (!user) {
            return res.status(400).json({ error: `User not found for location_id: ${locationId}` });
        }

        const ghlauthRecord = await Ghlauth.findOne({ location_id: locationId });
        if (!ghlauthRecord || !ghlauthRecord.access_token) {
            return res.status(400).json({ error: 'Access token not found for this location' });
        }

        const accessToken = ghlauthRecord.access_token;

        const appointmentResult = await makeAppointmentCall(payload, accessToken,user);

        if(appointmentResult.rejectionTag) {
            appointmentResult.rejectionTag = rejection_tag;
        }
        return res.status(200).json(appointmentResult);

    } catch (error) {
        console.error("Appointment creation failed:", error.response?.data || error.message);
        res.status(500).json({ success: false, message: "Failed to create appointment" });
    }
};


