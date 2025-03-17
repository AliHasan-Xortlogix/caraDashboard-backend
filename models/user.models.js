const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Define the User schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },

    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    status: {
        type: String, enum: ['active','inactive'], 
        default: 'active',
    },
    company_id: { type: String, default: null },
    location_id: { type: String, default: null },
    ghl_api_key: { type: String, default: null },
    role: {
        type: String,
        enum: ['superadmin', 'company'], 
        default: 'company', 
    },
    image: { type: String, default: null },
    added_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to User model
        default: null
    },
    email_verified_at: { type: Date, default: null },
    remember_token: { type: String, default: null },
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

// Method to compare password
userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// Method to generate JWT token with role info
userSchema.methods.getJwtToken = function () {
    return jwt.sign(
        { id: this._id, role: this.role }, // Include role in JWT token payload
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
    );
};

// Pre-save hook to hash password before saving
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
