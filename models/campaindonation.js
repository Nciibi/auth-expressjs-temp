const mongoose = require('mongoose');

const campaindonationSchema = new mongoose.Schema({
    campaign_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campain',
        required: true,
    },
    donated_amount: { type: Number, default: 0 },
    donations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation',
    }],
}, { timestamps: true });

module.exports = mongoose.model('Campaindonation', campaindonationSchema);
