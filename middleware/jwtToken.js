const jwt = require('jsonwebtoken');
const User = require('../models/user.models');

exports.isAuthenticatedUser = async (req, res, next) => {
    const { token } = req.cookies;
    //||req.cookies req.header('Authorization')?.replace('Bearer ', '')
    console.log(token)
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Login first to access this resource"
        })
    }
    try {
        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decodedData.id);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Login first to access this resource"
        })
    }
}
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role (${req.user.role}) is not allowed to access this resource`
            })
        }
        next();
    }
}