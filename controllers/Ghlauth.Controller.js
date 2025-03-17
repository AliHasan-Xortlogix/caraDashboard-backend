const axios = require('axios');
const qs = require('qs');
const Ghlauth = require('../models/Ghlauth.models');
const Settings = require('../models/Setting.models');
const User = require('../models/user.models'); // Assuming this is the user model
async function getSuperadminSettings() {
    try {
        // Find the user with the role 'superadmin'
        const superadmin = await User.findOne({ role: 'superadmin' });

        if (!superadmin) {
            throw new Error('Superadmin user not found');
        }

        const userId = superadmin._id; // Assuming _id is the identifier

        // Fetch client_id and client_secret from the Settings table
        const clientIdSetting = await Settings.findOne({ user_id: userId, key: 'client_id' });
        const clientSecretSetting = await Settings.findOne({ user_id: userId, key: 'client_secret' });

        if (!clientIdSetting || !clientSecretSetting) {
            throw new Error('Client ID or Client Secret not found');
        }

        return {
            clientId: clientIdSetting.value,
            clientSecret: clientSecretSetting.value
        };
    } catch (error) {
        console.error('Error fetching superadmin settings:', error.message);
        throw error; // Rethrow or handle as needed
    }
}

// (async () => {
//     try {
//         const settings = await getSuperadminSettings();
//         console.log('Superadmin settings:', settings);
//     } catch (error) {
//         console.error('Failed to retrieve settings:', error.message);
//     }
// })();
async function handleAuth(req, res) {

    const redirectUri = process.env.REDIRECT_URI;
    const scope = process.env.GHL_SCOPE;


    try {

        const { clientId, clientSecret } = await getSuperadminSettings();
        if (!clientId || !clientSecret) {
            return res.status(400).json({ message: 'Client ID and/or Secret not found for superadmin. Please add them.' });
        }
        const client_id = clientId;
        const client_secret = clientSecret;

        const url = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${redirectUri}&client_id=${client_id}&scope=${scope}`;
        console.log(url);
        return res.redirect(url);

    } catch (err) {
        return res.status(500).json({ error: 'Something went wrong: ' + err.message });
    }
}


async function handleCallback(req, res) {
    console.log("hi");
    const { code } = req.query;  // Get the authorization code from the query
    console.log('code', code);

    if (!code) {
        return res.status(400).json({ message: "Code is missing." });
    }

    try {
        const { clientId, clientSecret } = await getSuperadminSettings();
        if (!clientId || !clientSecret) {
            return res.status(400).json({ message: 'Client ID and/or Secret not found for superadmin. Please add them.' });
        }
        const client_id = clientId;
        const client_secret = clientSecret;

        const data = qs.stringify({
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': process.env.REDIRECT_URI
        });

        const configAxios = {
            method: 'post',
            url: 'https://services.leadconnectorhq.com/oauth/token',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: data
        };

        // Make the API request to exchange the authorization code for tokens
        const response = await axios.request(configAxios);
        console.log(response.data);

        const { access_token, refresh_token, expires_in, companyId: company_id, locationId: location_id, userType } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);  // Set the expiration time of the token

        // Fetch user_id from the User table using the location_id
        const user = await User.findOne({ location_id: location_id });

        if (!user) {
            return res.status(404).json({ message: 'User not found for the given location_id.' });
        }

        const user_id = user._id;  // Assuming the user document has _id field

        // Check if the user with the given locationId already exists in the Token collection
        const existingUser = await Ghlauth.findOne({ location_id: location_id });

        if (existingUser) {
            // If the user exists, update their access token and refresh token
            existingUser.access_token = access_token;
            existingUser.refresh_token = refresh_token;
            existingUser.expires_at = expiresAt;  // Store the expiration time
            await existingUser.save();
            console.log('User tokens updated.');
        } else {
            // If the user does not exist, create a new user in the Token collection
            await Ghlauth.create({
                location_id: location_id,
                access_token: access_token,
                refresh_token: refresh_token,
                expires_at: expiresAt,
                company_id: company_id,
                user_type: userType,
                user_id: user_id
            });
            console.log('New user created with tokens.');
        }

        // Respond with a success message and the token data
        return res.json({ message: 'Authorization successful', data: response.data });

    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ error: 'Something went wrong during callback handling: ' + err.message });
    }
}



module.exports = { handleAuth, handleCallback, getSuperadminSettings };
