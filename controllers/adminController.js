const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Organizer = require('../models/organizer');
const Donator = require('../models/donator');
const Campain = require('../models/campaign');
const Orgverification = require('../models/orgverification');
const Donation = require('../models/donation');
const AuditLog = require('../models/AuditLog');
const Campaindonation = require('../models/campaindonation');
const Admin = require('../models/admin');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { cleanupImage } = require('../utils/imageCleanup');

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new AppError('Email and password are required', 400, 3);
    }
    const admin = await Admin.findOne({ email });
    if (!admin) {
        throw new AppError('Admin not found', 404, 4);
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
        throw new AppError('Invalid password', 401, 5);
    }
    const token = jwt.sign({ id: admin._id, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    return res.status(200).json({ success: true, message: 'Admin logged in successfully', data: { admin, token } });
});

const getAllUsers = asyncHandler(async (req, res) => {
    const organizers = await Organizer.find();
    const donors = await Donator.find();
    return res.status(200).json({
        success: true,
        message: 'Users fetched successfully',
        data: { organizers, donors }
    });
});

const getOrganizor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizer = await Organizer.findById(id);
    if (!organizer) {
        throw new AppError('Organizer not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Organizer fetched successfully',
        data: organizer
    });
});

const updateOrganizor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizer = await Organizer.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!organizer) {
        throw new AppError('Organizer not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Organizer updated successfully',
        data: organizer
    });
});

const deleteOrganizor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizer = await Organizer.findByIdAndDelete(id);
    if (!organizer) {
        throw new AppError('Organizer not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Organizer deleted successfully',
        data: organizer
    });
});

const getDonor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const donator = await Donator.findById(id);
    if (!donator) {
        throw new AppError('Donor not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Donor fetched successfully',
        data: donator
    });
});

const updateDonor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const donator = await Donator.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!donator) {
        throw new AppError('Donor not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Donor updated successfully',
        data: donator
    });
});

const deleteDonor = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const donator = await Donator.findByIdAndDelete(id);
    if (!donator) {
        throw new AppError('Donor not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Donor deleted successfully',
        data: donator
    });
});

const getAllVerifications = asyncHandler(async (req, res) => {
    const verifications = await Orgverification.find();
    return res.status(200).json({
        success: true,
        message: 'Verifications fetched successfully',
        data: verifications
    });
});

const getPendingVerifications = asyncHandler(async (req, res) => {
    const verifications = await Orgverification.find({ status: 'pending' });
    return res.status(200).json({
        success: true,
        message: 'Pending verifications fetched successfully',
        data: verifications
    });
});

const getApprovedVerifications = asyncHandler(async (req, res) => {
    const verifications = await Orgverification.find({ status: 'approved' });
    return res.status(200).json({
        success: true,
        message: 'Approved verifications fetched successfully',
        data: verifications
    });
});

const getRejectedVerifications = asyncHandler(async (req, res) => {
    const verifications = await Orgverification.find({ status: 'rejected' });
    return res.status(200).json({
        success: true,
        message: 'Rejected verifications fetched successfully',
        data: verifications
    });
});

const getVerificationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgverification = await Orgverification.findById(id);
    if (!orgverification) {
        throw new AppError('Verification not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Verification fetched successfully',
        data: orgverification
    });
});

const updateVerification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, review_comments } = req.body;
    const orgverification = await Orgverification.findByIdAndUpdate(
        id,
        { status, review_comments, review_date: Date.now(), reviewed_by_admin: req.user.id },
        { new: true }
    );
    if (!orgverification) {
        throw new AppError('Verification not found', 404, 4);
    }
    if (status === 'approved') {
        const organizer = await Organizer.findById(orgverification.organizer_id);
        if (organizer) {
            organizer.is_verified = true;
            await organizer.save();
        }
    }
    return res.status(200).json({
        success: true,
        message: 'Verification updated successfully',
        data: orgverification
    });
});

const deleteVerification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const orgverification = await Orgverification.findByIdAndDelete(id);
    if (!orgverification) {
        throw new AppError('Verification not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Verification deleted successfully',
        data: orgverification
    });
});

const getAllDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find();
    return res.status(200).json({
        success: true,
        message: 'Donations fetched successfully',
        data: donations
    });
});

const getPendingDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find({ status: 'pending' });
    return res.status(200).json({
        success: true,
        message: 'Pending donations fetched successfully',
        data: donations
    });
});

const getApprovedDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find({ status: 'approved' });
    return res.status(200).json({
        success: true,
        message: 'Approved donations fetched successfully',
        data: donations
    });
});

const getRejectedDonations = asyncHandler(async (req, res) => {
    const donations = await Donation.find({ status: 'rejected' });
    return res.status(200).json({
        success: true,
        message: 'Rejected donations fetched successfully',
        data: donations
    });
});

const getDonationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const donation = await Donation.findById(id);
    if (!donation) {
        throw new AppError('Donation not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Donation fetched successfully',
        data: donation
    });
});

const updateDonation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (req.body.status === 'approved' && req.body.amount > 0) {
        const donation = await Donation.findByIdAndUpdate(id, req.body, { new: true });
        if (!donation) {
            throw new AppError('Donation not found', 404, 4);
        }
        if (donation.campaign_id && donation.amount) {
            const campaign_donation = await Campaindonation.findOne({ campaign_id: donation.campaign_id });
            if (campaign_donation) {
                campaign_donation.donated_amount = (campaign_donation.donated_amount || 0) + donation.amount;
                if (!campaign_donation.donations) campaign_donation.donations = [];
                campaign_donation.donations.push(donation._id);
                await campaign_donation.save();
            }
        }
        return res.status(200).json({
            success: true,
            message: 'Donation updated successfully',
            data: donation
        });
    }

    if (req.body.status === 'rejected' || req.body.status === 'pending') {
        const donation = await Donation.findByIdAndUpdate(id, req.body, { new: true });
        if (!donation) {
            throw new AppError('Donation not found', 404, 4);
        }
        if (donation.campaign_id && donation.amount) {
            const campaign_donation = await Campaindonation.findOne({ campaign_id: donation.campaign_id });
            if (campaign_donation) {
                campaign_donation.donated_amount = Math.max(0, (campaign_donation.donated_amount || 0) - donation.amount);
                if (campaign_donation.donations) {
                    campaign_donation.donations = campaign_donation.donations.filter(
                        d => d.toString() !== donation._id.toString()
                    );
                }
                await campaign_donation.save();
            }
        }
        return res.status(200).json({
            success: true,
            message: 'Donation updated successfully',
            data: donation
        });
    }

    throw new AppError('Invalid donation data', 400, 3);
});

const deleteDonation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const donation = await Donation.findByIdAndDelete(id);
    if (!donation) {
        throw new AppError('Donation not found', 404, 4);
    }
    const campaign_donation = await Campaindonation.findById(donation.id);
    if (campaign_donation) {
        campaign_donation.donated_amount = Math.max(0, (campaign_donation.donated_amount || 0) - (donation.amount || 0));
        if (campaign_donation.donations) {
            campaign_donation.donations = campaign_donation.donations.filter(
                d => d.toString() !== id.toString()
            );
        }
        await campaign_donation.save();
    }
    return res.status(200).json({
        success: true,
        message: 'Donation deleted successfully',
        data: donation
    });
});

const getAllAuditLogs = asyncHandler(async (req, res) => {
    const auditLogs = await AuditLog.find().sort({ timestamp: -1 });
    return res.status(200).json({
        success: true,
        message: 'Audit logs fetched successfully',
        data: auditLogs
    });
});

const getAuditLogById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const auditLog = await AuditLog.findById(id);
    if (!auditLog) {
        throw new AppError('Audit log not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Audit log fetched successfully',
        data: auditLog
    });
});

const deleteAuditLog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const auditLog = await AuditLog.findByIdAndDelete(id);
    if (!auditLog) {
        throw new AppError('Audit log not found', 404, 4);
    }
    return res.status(200).json({
        success: true,
        message: 'Audit log deleted successfully',
        data: auditLog
    });
});

const getAllApprovedCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'approved' });
    return res.status(200).json({
        success: true,
        message: 'Approved campaigns fetched successfully',
        data: campains
    });
});

const getAllRejectedCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'rejected' });
    return res.status(200).json({
        success: true,
        message: 'Rejected campaigns fetched successfully',
        data: campains
    });
});

const getAllPendingCampains = asyncHandler(async (req, res) => {
    const campains = await Campain.find({ status: 'pending' });
    return res.status(200).json({
        success: true,
        message: 'Pending campaigns fetched successfully',
        data: campains
    });
});

const getAllorganizors = asyncHandler(async (req, res) => {
    const organizors = await Organizer.find().lean();
    return res.status(200).json({
        success: true,
        message: 'Organizers fetched successfully',
        data: organizors
    });
});

const getAllApprovedorganizors = asyncHandler(async (req, res) => {
    const organizors = await Organizer.find({ is_verified: true }).lean();
    return res.status(200).json({
        success: true,
        message: 'Approved organizers fetched successfully',
        data: organizors
    });
});

const getAllRejectedorganizors = asyncHandler(async (req, res) => {
    const organizors = await Organizer.find({ is_verified: false }).lean();
    return res.status(200).json({
        success: true,
        message: 'Rejected organizers fetched successfully',
        data: organizors
    });
});

const getAllPendingorganizors = asyncHandler(async (req, res) => {
    const organizors = await Organizer.find({ is_verified: null }).lean();
    return res.status(200).json({
        success: true,
        message: 'Pending organizers fetched successfully',
        data: organizors
    });
});

module.exports = {
    login,
    getAllApprovedCampains,
    getAllRejectedCampains,
    getAllPendingCampains,
    getAllorganizors,
    getAllApprovedorganizors,
    getAllRejectedorganizors,
    getAllPendingorganizors,
    getPendingDonations,
    getApprovedDonations,
    getRejectedDonations,
    getApprovedVerifications,
    getRejectedVerifications,
    getPendingVerifications,
    getAllUsers,
    getOrganizor,
    updateOrganizor,
    deleteOrganizor,
    getDonor,
    updateDonor,
    deleteDonor,
    getAllVerifications,
    getVerificationById,
    updateVerification,
    deleteVerification,
    getAllDonations,
    getDonationById,
    updateDonation,
    deleteDonation,
    getAllAuditLogs,
    getAuditLogById,
    deleteAuditLog
};
