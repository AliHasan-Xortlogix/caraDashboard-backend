const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    forgotPassword,
    resetPassword,
    logoutUser, getAllUsers
} = require('../controllers/user.Controller');

const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');

// Register route (public, no authentication required)
router.post('/register', registerUser);

// Login route (public, no authentication required)
router.post('/login', loginUser);

// Get the current logged-in user's profile (protected route)
router.get('/profile', isAuthenticatedUser, getUserProfile);
router.get('/getall', getAllUsers);
// Update the logged-in user's profile (protected route)
router.put('/profile', isAuthenticatedUser, upload.single('image'), updateUserProfile);

// Forgot password route (public, no authentication required)
router.post('/forgot-password', forgotPassword);

// Reset password route (using the token sent via email) (public)
router.put('/reset-password/:token', resetPassword);

// Logout route (protected, user must be logged in)
router.get('/logout', isAuthenticatedUser, logoutUser);

module.exports = router;
