const axios = require('axios');
const qs = require('qs');
const Token = require('../models/Ghlauth.models');
const Settings = require('../models/Setting.models');

async function handleAuth(req, res) {
    const { user_id } = req;
    const redirectUri = process.env.REDIRECT_URI; // Use the redirect URI from the .env file
    const scope = process.env.GHL_SCOPE; // Use the scope from the .env file

    if (!user_id) {
        return res.status(400).json({ message: "user_id is required in the query parameters." });
    }

    try {
        // Step 1: Check if the user has a valid token
        let token = await Token.findOne({ where: { user_id } });
        const currentDate = new Date();

        if (token && new Date(token.expires_at) > currentDate) {
            // Token is valid, return it
            return res.json({ message: "Already connected", data: token });
        }

        // Step 2: Token expired but refresh token available
        if (token && new Date(token.expires_at) <= currentDate && token.refresh_token) {
            // Get client_id and client_secret from Settings table
            const clientIdSetting = await Settings.findOne({ user_id, key: 'client_id' });
            const clientSecretSetting = await Settings.findOne({ user_id, key: 'client_secret' });

            if (!clientIdSetting || !clientSecretSetting) {
                return res.status(400).json({ message: 'Client ID and/or Secret not found in settings for the user. Please add them.' });
            }

            const client_id = clientIdSetting.value;
            const client_secret = clientSecretSetting.value;

            const data = qs.stringify({
                'client_id': client_id,
                'client_secret': client_secret,
                'grant_type': 'refresh_token',
                'refresh_token': token.refresh_token,
                'user_type': 'Location',
                'redirect_uri': redirectUri
            });

            const configAxios = {
                method: 'post',
                url: `${process.env.GHL_BASE_URL}/oauth/token`, // Use the base URL from the .env file
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: data
            };

            const response = await axios.request(configAxios);
            const { access_token, expires_in } = response.data;

            // Update token in the database
            const expiresAt = new Date(Date.now() + expires_in * 1000);
            await Token.update(
                { access_token, expires_at: expiresAt },
                { where: { user_id } }
            );

            return res.json({ message: 'Token refreshed successfully', data: response.data });
        }

        // Step 3: No token or no refresh token, initiate OAuth flow
        // Get client_id and client_secret from Settings table
        const clientIdSetting = await Settings.findOne({ user_id, key: 'client_id' });
        const clientSecretSetting = await Settings.findOne({ user_id, key: 'client_secret' });

        if (!clientIdSetting || !clientSecretSetting) {
            return res.status(400).json({ message: 'Client ID and/or Secret not found in settings. Please add them.' });
        }

        const client_id = clientIdSetting.value;
        const client_secret = clientSecretSetting.value;

        const url = `${process.env.GHL_BASE_URL}/oauth/chooselocation?response_type=code&redirect_uri=${redirectUri}&client_id=${client_id}&scope=${scope}`;
        return res.redirect(url);
    } catch (err) {
        return res.status(500).json({ error: 'Something went wrong: ' + err.message });
    }
}

module.exports = { handleAuth };
