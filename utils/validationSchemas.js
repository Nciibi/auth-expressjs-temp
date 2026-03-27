const { z } = require('zod');

// Strong password schema (min 8, at least one uppercase, lowercase, and number)
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

// User Registration Schema
const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address format'),
    password: passwordSchema,
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().nullable(),
    role: z.string().optional()
});

// User Login Schema
const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
    role: z.string()
});

// Password Reset Schema
const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema
});

// Email Verification Code Schema
const verifyEmailSchema = z.object({
    email: z.string().trim().email('Invalid email address format'),
    code: z.string().length(6, 'Verification code must be 6 digits')
});

module.exports = {
    registerSchema,
    loginSchema,
    resetPasswordSchema,
    verifyEmailSchema
};
