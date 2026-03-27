const Organizer = require('../models/organizer')
const Donator = require('../models/donator')
const Campain = require('../models/campaign')
const Orgverification = require('../models/orgverification')
const Donation = require('../models/donation')
const AuditLog = require('../models/AuditLog')
const Campaindonation = require('../models/campaindonation')
const Admin = require('../models/admin')
//get all organizers and donors and their infos
const login =async (req,res) => {
    const {email,password} = req.body;
    try {
        if(!email || !password){
            return res.status(400).json({success:false,message:'Email and password are required'});
        }
        const admin = await Admin.findOne({email});
        if(!admin){
            return res.status(404).json({success:false,message:'Admin not found'});
        }
        const isPasswordValid = await bcrypt.compare(password,admin.password);
        if(!isPasswordValid){
            return res.status(401).json({success:false,message:'Invalid password'});
        }
        const token = generateToken(admin._id);
        return res.status(200).json({success:true,message:'Admin logged in successfully',data:{admin,token}});
    } catch (error) {
        console.error('Error logging in:',error);
        return res.status(500).json({success:false,message:'Server error'});
    }
}

const getAllUsers = async (req, res) => {
    try {
        const organizers = await Organizor.find();
        const donors = await Donor.find();
        return res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            data: { organizers, donors }
        });
    } catch (error) {
        console.error('Error getting users:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};  


//get an organizer by id and his infos
const getOrganizor = async (req, res) => {
    try {
        const { id } = req.params;
        const organizer = await Organizer.findById(id);
        return res.status(200).json({
            success: true,
            message: 'Organizor fetched successfully',
            data: organizer
        });
    } catch (error) {
        console.error('Error getting organizor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//update an organizer by id and his infos
const updateOrganizor = async (req, res) => {
    try {
        const { id } = req.params;
        const organizer = await Organizer.findByIdAndUpdate(id, req.body, { new: true });
        return res.status(200).json({
            success: true,
            message: 'Organizor updated successfully',
            data: organizer
        });
    } catch (error) {
        console.error('Error updating organizor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const deleteOrganizor = async (req, res) => {
    try {
        const { id } = req.params;
        const organizer = await Organizer.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Organizor deleted successfully',
            data: organizer
        });
    } catch (error) {
        console.error('Error deleting organizor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get a donor by id and his infos
const getDonor = async (req, res) => {
    try {
        const { id } = req.params;
        const donator = await Donator.findById(id);
        return res.status(200).json({
            success: true,
            message: 'Donor fetched successfully',
            data: donator
        });
    } catch (error) {
        console.error('Error getting donor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const updateDonor = async (req, res) => {
    try {
        const { id } = req.params;
        const donator = await Donator.findByIdAndUpdate(id, req.body, { new: true });
        return res.status(200).json({
            success: true,
            message: 'Donor updated successfully',
            data: donator
        });
    } catch (error) {
        console.error('Error updating donor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const deleteDonor = async (req, res) => {
    try {
        const { id } = req.params;
        const donator = await Donator.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Donor deleted successfully',
            data: donator
        });
    } catch (error) {
        console.error('Error deleting donor:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


//get all verifications and their infos
const getAllVerifications = async (req, res) => {
    try {
        const verifications = await Orgverification.find();
        return res.status(200).json({
            success: true,
            message: 'Verifications fetched successfully',
            data: verifications
        });
    } catch (error) {
        console.error('Error getting verifications:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getPendingVerifications = async (req, res) => {
    try {
        const verifications = await Orgverification.find({ status: 'pending' });
        return res.status(200).json({
            success: true,
            message: 'Pending verifications fetched successfully',
            data: verifications
        });
    } catch (error) {
        console.error('Error getting pending verifications:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getApprovedVerifications = async (req, res) => {
    try {
        const verifications = await Orgverification.find({ status: 'approved' });
        return res.status(200).json({
            success: true,
            message: 'Approved verifications fetched successfully',
            data: verifications
        });
    } catch (error) {
        console.error('Error getting approved verifications:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getRejectedVerifications = async (req, res) => {
    try {
        const verifications = await Orgverification.find({ status: 'rejected' });
        return res.status(200).json({
            success: true,
            message: 'Rejected verifications fetched successfully',
            data: verifications
        });
    } catch (error) {
        console.error('Error getting rejected verifications:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get a verification by id and his infos
const getVerificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const orgverification = await Orgverification.findById(id);
        return res.status(200).json({
            success: true,
            message: 'Verification fetched successfully',
            data: orgverification
        });
    } catch (error) {
        console.error('Error getting verification:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//update a verification by id and his infos
const updateVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, review_comments } = req.body;
        const orgverification = await Orgverification.findByIdAndUpdate(
            id, 
            { status, review_comments, review_date: Date.now(), reviewed_by_admin: req.user.id }, 
            { new: true }
        );
        if(status === 'approved') {
            const organizer = await Organizer.findById(orgverification.organizer_id);
            organizer.is_verified = true;
            await organizer.save();
        }
        return res.status(200).json({
            success: true,
            message: 'Verification updated successfully',
            data: orgverification
        });
    } catch (error) {
        console.error('Error updating verification:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//delete a verification by id and his infos
const deleteVerification = async (req, res) => {
    try {
        const { id } = req.params;
        const orgverification = await Orgverification.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Verification deleted successfully',
            data: orgverification
        });
    } catch (error) {
        console.error('Error deleting verification:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get all donations and their infos
const getAllDonations = async (req, res) => {
    try {
        const donations = await Donation.find();
        return res.status(200).json({
            success: true,
            message: 'Donations fetched successfully',
            data: donations
        });
    } catch (error) {
        console.error('Error getting donations:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get pending donations
const getPendingDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ status: 'pending' });
        return res.status(200).json({
            success: true,
            message: 'Pending donations fetched successfully',
            data: donations
        });
    } catch (error) {
        console.error('Error getting pending donations:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get approved donations
const getApprovedDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ status: 'approved' });
        return res.status(200).json({
            success: true,
            message: 'Approved donations fetched successfully',
            data: donations
        });
    } catch (error) {
        console.error('Error getting approved donations:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get rejected donations
const getRejectedDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ status: 'rejected' });
        return res.status(200).json({
            success: true,
            message: 'Rejected donations fetched successfully',
            data: donations
        });
    } catch (error) {
        console.error('Error getting rejected donations:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get a donation by id and his infos
const getDonationById = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await Donation.findById(id);
        return res.status(200).json({
            success: true,
            message: 'Donation fetched successfully',
            data: donation
        });
    } catch (error) {
        console.error('Error getting donation:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//update a donation by id and his infos
const updateDonation = async (req, res) => {
    try {
        const { id } = req.params;
        if(req.body.status === 'approved' && req.body.amount > 0) {
            const donation = await Donation.findByIdAndUpdate(id, req.body, { new: true });
            if(donation.campaign_id){
                if(donation.amount){
                    const campaign_donation = await Campaindonation.find({campaign_id: donation.campaign_id});
                    campaign_donation.donated_amount += donation.amount;
                    campaign_donation.donations.push(donation._id);
                    await campaign_donation.save();
                }
            }
        }
        else{return res.status(400).json({ success: false, message: 'Invalid donation data' });}
        if(req.body.status === 'rejected' || req.body.status === 'pending') {
            const donation = await Donation.findByIdAndUpdate(id, req.body, { new: true });
            if(donation.campaign_id){
                if(donation.amount){
                    const campaign_donation = await Campaindonation.find({campaign_id: donation.campaign_id});
                    campaign_donation.donated_amount -= donation.amount;
                    for(let i = 0; i < campaign_donation.donations.length; i++) {
                        if(campaign_donation.donations[i].toString() === donation._id.toString()) {
                            campaign_donation.donations.splice(i, 1);
                            break;
                        }
                    }
                    await campaign_donation.save();
                }
            }
            
        }
        return res.status(200).json({
            success: true,
            message: 'Donation updated successfully',
            data: donation
        });
    } catch (error) {
        console.error('Error updating donation:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//delete a donation by id and his infos
const deleteDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await Donation.findByIdAndDelete(id);
        const campaign_donation = await Campaindonation.findById(donation.id);
        campaign_donation.donated_amount -= donation.amount;
        for(let i = 0; i < campaign_donation.donations.length; i++) {
            if(campaign_donation.donations[i].toString() === id.toString()) {
                campaign_donation.donations.splice(i, 1);
                break;
            }
        }
        await campaign_donation.save();
        return res.status(200).json({
            success: true,
            message: 'Donation deleted successfully',
            data: donation
        });
    } catch (error) {
        console.error('Error deleting donation:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get all audit logs and their infos
const getAllAuditLogs = async (req, res) => {
    try {
        const auditLogs = await AuditLog.find().sort({timestamp: -1});
        return res.status(200).json({
            success: true,
            message: 'Audit logs fetched successfully',
            data: auditLogs
        });
    } catch (error) {
        console.error('Error getting audit logs:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//get an audit log by id and his infos
const getAuditLogById = async (req, res) => {
    try {
        const { id } = req.params;
        const auditLog = await AuditLog.findById(id);
        return res.status(200).json({
            success: true,
            message: 'Audit log fetched successfully',
            data: auditLog
        });
    } catch (error) {
        console.error('Error getting audit log:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

//delete an audit log by id and his infos
const deleteAuditLog = async (req, res) => {
    try {
        const { id } = req.params;
        const auditLog = await AuditLog.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Audit log deleted successfully , hope ur not deleting this for a bad reason or hiding something :)',
            data: auditLog
        });
    } catch (error) {
        console.error('Error deleting audit log:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllApprovedCampains = async (req, res) => {
    try {
        const campains = await Campain.find({ status: 'approved' });
        return res.status(200).json({
            success: true,
            message: 'Approved campains fetched successfully',
            data: campains
        });
    } catch (error) {
        console.error('Error getting approved campains:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllRejectedCampains = async (req, res) => {
    try {
        const campains = await Campain.find({ status: 'rejected' });
        return res.status(200).json({
            success: true,
            message: 'Rejected campains fetched successfully',
            data: campains
        });
    } catch (error) {
        console.error('Error getting rejected campains:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllPendingCampains = async (req, res) => {
    try {
        const campains = await Campain.find({ status: 'pending' });
        return res.status(200).json({
            success: true,
            message: 'Pending campains fetched successfully',
            data: campains
        });
    } catch (error) {
        console.error('Error getting pending campains:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllorganizors = async (req, res) => {
    try {
        const organizors = await Organizer.find().lean();
        return res.status(200).json({
            success: true,
            message: 'Organizors fetched successfully',
            data: organizors
        });
    } catch (error) {
        console.error('Error getting organizors:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllApprovedorganizors = async (req, res) => {
    try {
        const organizors = await Organizer.find({ is_verified: true }).lean();
        return res.status(200).json({
            success: true,
            message: 'Approved organizors fetched successfully',
            data: organizors
        });
    } catch (error) {
        console.error('Error getting approved organizors:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllRejectedorganizors = async (req, res) => {
    try {
        const organizors = await Organizer.find({ is_verified: false }).lean();
        return res.status(200).json({
            success: true,
            message: 'Rejected organizors fetched successfully',
            data: organizors
        });
    } catch (error) {
        console.error('Error getting rejected organizors:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getAllPendingorganizors = async (req, res) => {
    try {
        const organizors = await Organizer.find({ is_verified: null }).lean();
        return res.status(200).json({
            success: true,
            message: 'Pending organizors fetched successfully',
            data: organizors
        });
    } catch (error) {
        console.error('Error getting pending organizors:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports =  {
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
}