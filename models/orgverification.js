const mongoose = require('mongoose');

const orgverificationSchema = new mongoose.Schema({
    organizer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organizer',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    review_comments: { type: String, default: '' },
    review_date: { type: Date, default: null },
    reviewed_by_admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model('Orgverification', orgverificationSchema);
