const User = require('../models/user.models');
const ErrorHandler = require('../utils/Errorhandler');
const sendToken = require('../utils/SendToken');
const sendEmail = require('../utils/sendEmail');
const catchAsyncErrors = require('../middleware/catchAsyncError');
const { userCreateSchema } = require('../Validations/User.Validation');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const upload = require('../middleware/multer'); 
// Register a new user => /api/v1/register
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
    // Validate request body using Joi
    const result = await userCreateSchema.validateAsync(req.body);
    const { name, email, password, role = 'company', added_by } = result;

    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        return next(new ErrorHandler('User already exists with this email', 400));
    }

    // Create a new user
    const user = await User.create({
        
        name,
        email,
        password,
        role,
        added_by, // optional, can reference another user (e.g., an admin)
    });

    // Send JWT Token response
    sendToken(user, 201, res);
});

// Login user => /api/v1/login
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return next(new ErrorHandler('Please provide email and password', 400));
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
        return next(new ErrorHandler('Invalid credentials', 401));
    }

    // Compare the entered password with the stored password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
        return next(new ErrorHandler('Invalid credentials', 401));
    }

    // Send JWT Token response
    sendToken(user, 200, res);
});

// Get all users => /api/v1/users
exports.getAllUsers = catchAsyncErrors(async (req, res, next) => {
    const users = await User.find();

    if (!users || users.length === 0) {
        return next(new ErrorHandler('No users found', 404));
    }

    res.status(200).json({
        success: true,
        users,
    });
});

// Get current logged-in user's profile => /api/v1/profile
exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id); // Using user ID from JWT

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    res.status(200).json({
        success: true,
        user,
    });
});

// Update user profile => /api/v1/profile
exports.updateUserProfile = catchAsyncErrors(async (req, res, next) => {
    const { name, email, password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Handle image upload (if provided)
    if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`; // Get the image URL (relative path)
        req.body.image = imageUrl; // Save the image URL in the request body
    }

    // If password is provided, hash it before updating
    if (password) {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(password, salt);
    }

    // Update user details
    const updatedUser = await User.findByIdAndUpdate(req.user.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        success: true,
        user: updatedUser,
    });
});

// Delete user => /api/v1/delete-user/:userId
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Delete user
    await user.remove();

    res.status(200).json({
        success: true,
        message: 'User deleted successfully',
    });
});

// Forgot password => /api/v1/forgot-password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return next(new ErrorHandler('User not found with this email', 404));
    }

    // Generate reset token and update user
    const resetToken = user.getResetPasswordToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `You are receiving this email because we received a password reset request for your account. Please click the following link to reset your password: \n\n ${resetUrl}`;

    try {
        await sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            message,
        });

        res.status(200).json({
            success: true,
            message: `Email sent to ${user.email} successfully`,
        });
    } catch (error) {
        user.reset_token = undefined;
        user.reset_token_expiry = undefined;
        await user.save();
        return next(new ErrorHandler('Email could not be sent', 500));
    }
});

// Reset password => /api/v1/reset-password/:token
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
    const resetToken = req.params.token;
    const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    const user = await User.findOne({
        reset_token: hashedToken,
        reset_token_expiry: { $gt: Date.now() },
    });

    if (!user) {
        return next(new ErrorHandler('Invalid or expired reset token', 400));
    }

    // Update the password
    user.password = req.body.password;
    user.reset_token = undefined;
    user.reset_token_expiry = undefined;
    await user.save();

    sendToken(user, 200, res);
});

// Logout user => /api/v1/logout
exports.logoutUser = catchAsyncErrors(async (req, res, next) => {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
        httpOnly: true,
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
});
