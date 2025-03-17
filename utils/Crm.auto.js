const GhlAuth = require("../models/Ghlauth.models");
const axios = require("axios");
const cache = new Map();
const { getSuperadminSettings } = require('../controllers/Ghlauth.Controller');
const winston = require('winston'); // For logging

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

class CRM {
    constructor() {
        this.baseUrl = "https://services.leadconnectorhq.com/";
        this.version = "2021-07-28";
        this.crmModel = GhlAuth;
        this.langCom = "Company";
        this.langLoc = "Location";
        this.userType = { Company: "company_id", Location: "location_id" };
        this.scopes = process.env.GHL_SCOPE;
        this.noToken = "No Token";
        this.noRecord = "No Data"; // Ensure the environment variable is set
    }

    // Helper method to handle API calls with error handling
    static async makeCall(url, method = "GET", data = null, headers = {}, json = true) {
        try {

            const requestOptions = {
                method: method.toUpperCase(),
                url,
                headers,
                timeout: 30000,  // Timeout of 30 seconds
            };

            if (data) {
                requestOptions.data = json ? JSON.stringify(data) : new URLSearchParams(data).toString();
            }
            if (json) {
                headers["Content-Type"] = "application/json";
            }
            // console.log('Request of MakeCall',JSON.stringify(requestOptions));
            const response = await axios(requestOptions);
            return response.data;
        } catch (error) {
            logger.error(`API Call Error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
            throw new Error("API call failed");
        }
    }


    // Helper method to fetch or save CRM token
    async getCrmToken(where = {}) {
        try {
            return await this.crmModel.findOne(where);
        } catch (error) {
            logger.error("Error fetching CRM token:", error);
            throw new Error("Failed to fetch CRM token");
        }
    }

    // Save CRM token to the database
    async saveCrmToken(code, companyId, loc = null) {
        try {
            const where = { user_id: companyId };
            const type = code.userType;
            if (type === this.langLoc) where.location_id = code.locationId || "";

            if (code.companyId) where.company_id = code.companyId;

            let locRecord = loc || await this.getCrmToken(where);
            if (!locRecord) {
                locRecord = new this.crmModel({
                    location_id: code.locationId,
                    user_type: type,
                    company_id: code.companyId,
                    user_id: companyId,
                    crm_user_id: code.user_id,
                    expires_at: code.expires_in ? new Date(Date.now() + code.expires_in * 1000) : null
                });
            }

            locRecord.expires_in = code.expires_in || 0;
            locRecord.access_token = code.access_token;
            locRecord.refresh_token = code.refresh_token;
            await locRecord.save();
            console.log('locRecord', locRecord);
            return locRecord;
        } catch (error) {
            logger.error("Error saving CRM token:", error);
            throw new Error("Failed to save CRM token");
        }
    }

    // Base connect method to initialize OAuth connection
    static async baseConnect(scopes) {
        try {
            const { clientId, clientSecret } = await getSuperadminSettings();

            if (!clientId || !clientSecret) {
                throw new Error('Client ID and/or Secret not found for superadmin. Please add them.');
            }

            const callbackUrl = process.env.REDIRECT_URI || "http://yourdomain.com/crm/oauth_callback";
            return `response_type=code&redirect_uri=${encodeURIComponent(callbackUrl)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}`;
        } catch (error) {
            logger.error("Error during base connect:", error);
            throw new Error('Internal Server Error');
        }
    }

    // Direct connect method to redirect to OAuth flow
    static directConnect() {
        return `https://marketplace.gohighlevel.com/oauth/chooselocation?${CRM.baseConnect()}`;
    }

    // Method to initiate OAuth connection
    async connectOauth(mainId, token, isCompany = false, $userId = null) {
        try {
            if (!token) return false;

            const type = isCompany ? this.langCom : this.langLoc;
            let authType = this.userType[type];

            const authUrl = await CRM.baseConnect(this.scopes);

            const locUrl = `${this.baseUrl}oauth/authorize?${authType}=${mainId}&userType=${type}&${authUrl}`;

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            const response = await CRM.makeCall(locUrl, "POST", null, headers);

            if (response && response.redirectUrl) {
                const urlParams = new URL(response.redirectUrl);
                const code = urlParams.searchParams.get("code");
                return await this.goAndGetToken(code, '', $userId);
            }
            return false;
        } catch (error) {
            logger.error("Error connecting OAuth:", error);
            return false;
        }
    }
    async crmToken(code, method = '') {

        try {
            const { clientId, clientSecret } = await getSuperadminSettings();

            if (!clientId || !clientSecret) {
                throw new Error('Client ID and/or Secret not found for superadmin. Please add them.');
            }

            const md = method || 'code';
            if (!code) {
                return `${md} is required`;
            }

            // Prepare the form data for x-www-form-urlencoded format
            const data = {
                client_id: clientId,
                client_secret: clientSecret,
                [md]: code,
                grant_type: method ? 'refresh_token' : 'authorization_code',
            };
            console.log('data of crmToken', data);

            // Making the API call with x-www-form-urlencoded content type
            const response = await CRM.makeCall(`${this.baseUrl}oauth/token`, "POST", data, {
                "Content-Type": "application/x-www-form-urlencoded",
            }, false);

            return response;
        } catch (error) {
            logger.error(`CRM Token Error: ${error.response ? error.response.data : error.message}`);
            throw new Error("CRM token request failed");
        }
    }
    // Exchange code for a token
    async goAndGetToken(code, type = "", companyId = null, loc = null) {
        try {
            const token = await this.crmToken(code, type);

            if (token && token.access_token) {
                // Save the token
                console.log('response of crmToken', token);
                const savedToken = await this.saveCrmToken(token, companyId);
                return [true, savedToken];  // Ensure the saved token is returned
            }

            return [false, "Token retrieval failed"];
        } catch (error) {
            logger.error("Error during token exchange:", error);
            return [false, "Token exchange failed"];
        }
    }


    // Get location access token
    static async getLocationAccessToken(userId, locationId, token = null) {
        try {
            if (!token) token = await CRM.getCrmToken({ user_id: userId, user_type: "company" });

            const response = await CRM.makeCall(`${CRM.baseUrl}oauth/locationToken`, "POST", {
                companyId: token.company_id,
                locationId: locationId,
            }, {
                Accept: "application/json",
                Authorization: `Bearer ${token.access_token}`,
                "Content-Type": "application/x-www-form-urlencoded",
                Version: CRM.version,
            });

            if (response && response.access_token) {
                return await CRM.saveCrmToken(response, userId);
            } else {
                logger.error("Failed to get location access token");
                return null;
            }
        } catch (error) {
            logger.error("Error fetching location access token:", error);
            return null;
        }
    }

    // Check if token is expired
    static isExpired(response) {
        return response && response.error && response.error.includes("expired");
    }

    // Modify URL for specific location context
    static modifyUrl(url, location_id, location) {
        if (!url.includes("locations/")) {
            url = `locations/${location_id || location.location_id}/${url}`;
        }
        return url;
    }

    // Main CRM API call with token management
    static async crmV2(company_id, urlmain = "", method = "get", data = "", headers = {}, json = true, location_id = "") {
        if (!company_id) return "No Data";

        let location = await CRM.getLocationToken(company_id, location_id);
        if (!location) return "No Data";

        headers["Version"] = CRM.version;
        let accessToken = location?.access_token;

        if (!accessToken) return "No Token";

        // Check if token is expired and refresh if needed
        if (CRM.isExpired(location)) {
            location = await CRM.handleTokenRefresh(company_id, urlmain, method, data, headers, json, location);
            if (!location) return "Token Expired";
            accessToken = location?.access_token; // Update access token after refresh
        }

        const finalUrl = CRM.baseUrl + CRM.modifyUrl(urlmain, location_id, location);
        headers["Authorization"] = `Bearer ${accessToken}`;

        return await CRM.makeCall(finalUrl, method, data, headers, json);
    }

    // Handle token refresh logic when expired
    static async handleTokenRefresh(company_id, urlmain, method, data, headers, json, location) {
        const newLocation = await CRM.getRefreshToken(company_id, location);
        if (newLocation) {
            return CRM.crmV2(company_id, urlmain, method, data, headers, json, newLocation.location_id);
        }
        return "Token Expired";
    }

    // Get refreshed token using refresh token
    static async getRefreshToken(company_id, location) {
        const refreshToken = location.refresh_token;
        const response = await CRM.goAndGetToken(refreshToken, "refresh", company_id);
        return response[0] ? response[1] : null;
    }
}

module.exports = new CRM();