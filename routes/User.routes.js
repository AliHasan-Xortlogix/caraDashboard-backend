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
    logoutUser, getAllUsers, updateUserBySuperadmin, deleteUserBySuperadmin
} = require('../controllers/user.Controller');

const { isAuthenticatedUser, authorizeRoles } = require('../middleware/jwtToken');
router.post('/register', isAuthenticatedUser, authorizeRoles('superadmin'), registerUser);
router.post('/login', loginUser);
router.get('/profile', isAuthenticatedUser, getUserProfile);
router.get('/getall', isAuthenticatedUser, authorizeRoles('superadmin'), getAllUsers);
router.put('/profile', isAuthenticatedUser, upload.single('image'), updateUserProfile);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/logout', isAuthenticatedUser, logoutUser);
router.put('/edit/:userId', isAuthenticatedUser, authorizeRoles('superadmin'), updateUserBySuperadmin);
router.delete('/adminuser/:userId', isAuthenticatedUser, authorizeRoles('superadmin'), deleteUserBySuperadmin)
module.exports = router;
