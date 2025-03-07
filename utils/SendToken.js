const jwt = require('jsonwebtoken');

const sendToken = (user, statusCode, res) => {
    const token = user.getJwtToken(); // Assumes user object has a method to get JWT
    const options = {
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        httpOnly: true,
        sameSite: "none", // Adjust for your needs
        secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
    };

    // Correctly set status and send response
    res.cookie("token", token, options);
    return res.status(statusCode).json({
        success: true,
        user,
        token,
    });
};

module.exports = sendToken;
