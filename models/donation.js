const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    donor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donator',
        default: null,
    },
    campaign_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campain',
        default: null,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });

module.exports = mongoose.model('Donation', donationSchema);
