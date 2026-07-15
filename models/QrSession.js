const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['pending', 'authenticated', 'expired', 'used'],
        default: 'pending',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    userModel: { type: String, default: null },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 180,
    },
});

module.exports = mongoose.model('QrSession', qrSessionSchema);
