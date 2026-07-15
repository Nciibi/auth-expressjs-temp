const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    refreshTokens: [String],
    usedRefreshTokens: [{
        token: String,
        usedAt: Date,
    }],
    role: {
        type: String,
        default: 'ADMIN',
    },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
