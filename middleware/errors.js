const ErrorHandler = require("../utils/Errorhandler");

// Global Error Middleware
const error = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Specific error handling based on the error type
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors).map((val) => val.message).join(", ");
    }

    if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    if (err.code === 11000) {
        // MongoDB Duplicate Key Error
        statusCode = 400;
        const field = Object.keys(err.keyValue);
        message = `Duplicate field value entered: ${field}`;
    }

    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token. Please log in again.";
    }

    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Your session has expired. Please log in again.";
    }

    if (err.name === "SyntaxError" && err.message.includes("JSON")) {
        statusCode = 400;
        message = "Invalid JSON payload.";
    }

    // Sequelize (or other ORM) Validation Errors
    if (err.errors && err.errors[0]?.type === "Validation error") {
        statusCode = 400;
        message = err.errors.map((e) => e.message).join(", ");
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }), // Stack trace in development
    });
};

module.exports = error;
