const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    goalAmount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    images: [String],
    videos: [String],
    organizer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organizer',
        default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model('Campain', campaignSchema);
