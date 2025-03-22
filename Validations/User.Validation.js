const Joi = require('joi');

// User Create Schema
const userCreateSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(30)
        .required()
        .messages({
            'string.base': 'First name should be a string',
            'string.empty': 'First name cannot be empty',
            'string.min': 'First name should have at least 3 characters',
            'string.max': 'First name should have at most 30 characters',
            'any.required': 'First name is required',
        }),

    

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            'string.base': 'Email should be a string',
            'string.empty': 'Email cannot be empty',
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),

    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.base': 'Password should be a string',
            'string.empty': 'Password cannot be empty',
            'string.min': 'Password should have at least 6 characters',
            'any.required': 'Password is required',
        }),
    location_id: Joi.string().allow('').optional(),
    role: Joi.string().valid('company', 'superadmin').required(),
    status: Joi.string().valid('active', 'inactive').required()

});

module.exports = { userCreateSchema };
