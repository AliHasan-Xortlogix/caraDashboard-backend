// ErrorHandler.js (you already have this but make sure it's proper)
class ErrorHandler extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;

        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = ErrorHandler;
