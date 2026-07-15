const mongoose = require('mongoose');

const donatorSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: { type: String, required: true },
    phoneNumber: { type: String, default: null },
    role: { type: String, default: 'donator' },
    photo: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    isGoogleAuth: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
    lastIp: { type: String, default: null },
    deviceInfo: { type: String, default: null },
    refreshTokens: [String],
    usedRefreshTokens: [{
        token: String,
        usedAt: Date,
    }],
    mfaSecret: { type: String, default: null },
    isMfaEnabled: { type: Boolean, default: false },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Donator', donatorSchema);
