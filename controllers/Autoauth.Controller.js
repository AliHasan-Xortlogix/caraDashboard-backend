const User = require('../models/user.models');
const bcrypt = require('bcrypt');
const sendToken = require('../utils/SendToken');
const GhlAuth = require('../models/Ghlauth.models');
const CRM = require('../utils/Crm.auto');

const generateRandomPassword = () => {
    return Math.random().toString(36).slice(-8);
};

const validateEmail = (email) => {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
};

// Controller function for automatic authentication or user creation
const autoAuthController = async (req, res) => {
    const { location, token } = req.query;
    console.log(location, token);

    try {
        // Check if both location_id and token are provided
        if (!location || !token) {
            return res.status(400).json({
                success: false,
                message: 'Location ID and Token are required please check custom menu link.'
            });
        }

        let user = await User.findOne({ location_id: location });

        // if (!user) {
        //     // If user exists, return token
        //     // return sendToken(user, 200, res);
        //     // } else {
        //     // Create a new user
        //     const password = 12345678;  // Default password
        //     const email = `${location}@gmail.com`;  // Temporary email based on location
        //     const name = `${location}`;

        //     // Validate email format
        //     if (!validateEmail(email)) {
        //         return res.status(400).json({
        //             success: false,
        //             message: 'Invalid email format.'
        //         });
        //     }
 if (user) {
            // Check user status
            if (user.status === 'inactive') {
                return res.status(403).json({
                    success: false,
                    message: 'Your account has been deactivated please contact Admin.'
                });
            }
        } else {
            // Create a new user
            const rawPassword = '12345678'; // Default password
            const hashedPassword = await bcrypt.hash(rawPassword, 10);
            const email = `${location}@gmail.com`;
            const name = "New User";

            if (!validateEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format.'
                });
            }
            // Create the new user
            user = await User.create({
                name: name,
                location_id: location,
                ghl_api_key: token,
                email: email,
                password:hashedPassword,  // Default password, ideally should be hashed
                user_type: 'company',
                status: 'active'
            });
        }
        // Prepare response object
        let response = {
            user_id: user._id,
            location_id: user.location_id || null,
            is_crm: false,
            token: user.ghl_api_key,
            crm_connected: false,
        };

        // Check CRM connection
        let authToken = await GhlAuth.findOne({ user_id: user._id });

        if (authToken) {
            let [tokenx, refreshedToken] = await CRM.goAndGetToken(
                authToken.refresh_token,
                "refresh_token",
                user._id,
                authToken
            );
            console.log('Token retrieved:', tokenx, 'Refreshed Token:', refreshedToken);
            response.crm_connected = tokenx && refreshedToken;
        }

        // If CRM is not connected, attempt to connect via OAuth
        if (!response.crm_connected) {
            response.crm_connected = await CRM.connectOauth(location, response.token, false, user._id);
        }

        if (response.crm_connected) {
            // If CRM connected successfully, send token
            return sendToken(user, 201, res);
        }

        // CRM failed, respond with necessary info
        response.is_crm = response.crm_connected;
        response.token_id = user._id.toString();
        return sendToken(user, 200, res);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Server error, please try again later.'
        });
    }
};

module.exports = { autoAuthController };
