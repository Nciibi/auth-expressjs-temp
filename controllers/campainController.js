const Campain = require('../models/campaign');
const Campaindonation = require('../models/campaindonation');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { cleanupImage } = require('../utils/imageCleanup');

const getAllCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find().sort({ createdAt: -1 });
    return res.status(200).json({
        success: true,
        message: 'Campaigns fetched successfully',
        data: campains,
    });
});

const getAllPendingCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'pending' }).sort({ createdAt: -1 });
    return res.status(200).json({
        success: true,
        message: 'Pending campaigns fetched successfully',
        data: campains,
    });
});

const getAllApprovedCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'approved' }).sort({ createdAt: -1 });
    return res.status(200).json({
        success: true,
        message: 'Approved campaigns fetched successfully',
        data: campains,
    });
});

const getAllRejectedCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'rejected' }).sort({ createdAt: -1 });
    return res.status(200).json({
        success: true,
        message: 'Rejected campaigns fetched successfully',
        data: campains,
    });
});

const getCampainById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const campain = await Campain.findById(id);
    if (!campain) {
        throw new AppError('Campaign not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Campaign fetched successfully',
        data: campain,
    });
});

const updateCampain = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.files?.images) {
        const existing = await Campain.findById(id);
        if (existing?.images?.length) {
            for (const img of existing.images) {
                await cleanupImage(img);
            }
        }
        req.body.images = req.files.images.map(f => `/uploads/${f.filename}`);
    }

    const campain = await Campain.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!campain) {
        throw new AppError('Campaign not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Campaign updated successfully',
        data: campain,
    });
});

const deleteCampain = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const campain = await Campain.findById(id);
    if (!campain) {
        throw new AppError('Campaign not found', 404, 4);
    }

    if (campain.images?.length) {
        for (const img of campain.images) {
            await cleanupImage(img);
        }
    }

    await Campaindonation.deleteOne({ campaign_id: id });
    await Campain.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully',
        data: campain,
    });
});

module.exports = {
    getAllCampains,
    getAllPendingCampains,
    getAllApprovedCampains,
    getAllRejectedCampains,
    getCampainById,
    updateCampain,
    deleteCampain,
};
