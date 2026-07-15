const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { upload, processImage, uploadErrorHandler } = require('../middleware/advancedUpload');
const { middleware } = require('../middleware/errorLoggerMiddleware');
const authorize = require('../middleware/authorize');
const verifyJWT = require('../middleware/verifyJWT');
const loadUser = require('../middleware/loadUser');
const auditLog = require('../middleware/auditLog');
const { refresh, logout} = require('../controllers/authController');
const protect = [verifyJWT, loadUser];
const {login , getAllUsers, getOrganizor, updateOrganizor, deleteOrganizor, 
    getDonor, updateDonor, deleteDonor,  
    getAllVerifications, getVerificationById, updateVerification, deleteVerification, 
    getAllDonations, getDonationById, updateDonation, deleteDonation,  
    getAllAuditLogs, getAuditLogById, deleteAuditLog 
} = require('../controllers/adminController');
const { getAllCampains, getAllPendingCampains, getAllApprovedCampains, 
        getAllRejectedCampains, getCampainById, updateCampain, deleteCampain 
    } = require('../controllers/campainController');
const { getAllorganizors, getAllApprovedorganizors, getAllRejectedorganizors, getAllPendingorganizors} = require('../controllers/adminController.js');

// ========================
// Token Management
// ========================
router.post('/admin-login',login)

router.get('/refresh', refresh);
router.post('/logout', logout);

// ========================
// Sample Admin Route
// ========================
router.get('/admin/dashboard', protect, authorize('ADMIN'), auditLog('Access Admin Dashboard'), (req, res) => {
    res.json({ success: true, message: 'Welcome to the admin dashboard! ** dont do anything stupid plz :) **' });
});

//========================
//user management
//========================
router.get('/getAllUsers', protect, authorize('ADMIN'), auditLog('Access Users List'), getAllUsers);

//========================
//organizor management
//========================
router.get('/all', protect, authorize('ADMIN'), auditLog('Get all organizors by admin'), getAllorganizors);
router.get('/getOrganizor/:id', protect, authorize('ADMIN'), auditLog('Access organizor'), getOrganizor);
router.put('/updateOrganizor/:id', protect, authorize('ADMIN'), upload.single('image'), processImage, uploadErrorHandler, auditLog('Update organizor'), updateOrganizor);
router.delete('/deleteOrganizor/:id', protect, authorize('ADMIN'), auditLog('Delete organizor'), deleteOrganizor);
router.get('/getAllApprovedorganizors', protect, authorize('ADMIN'), auditLog('Get all approved organizors by admin'), getAllApprovedorganizors);
router.get('/getAllRejectedorganizors', protect, authorize('ADMIN'), auditLog('Get all rejected organizors by admin'), getAllRejectedorganizors);
router.get('/getAllPendingorganizors', protect, authorize('ADMIN'), auditLog('Get all pending organizors by admin'), getAllPendingorganizors);


//========================
//donor management
//========================
router.get('/getDonor/:id', protect, authorize('ADMIN'), auditLog('Access donor'), getDonor);
router.put('/updateDonor/:id', protect, authorize('ADMIN'), auditLog('Update donor'), updateDonor);
router.delete('/deleteDonor/:id', protect, authorize('ADMIN'), auditLog('Delete donor'), deleteDonor);


//================================
//campain verification management
//================================
router.get('/getAllPendingCampains', protect, authorize('ADMIN'), auditLog('Access pending campains'), getAllPendingCampains);
router.get('/getAllApprovedCampains', protect, authorize('ADMIN'), auditLog('Access approved campains'), getAllApprovedCampains);
router.get('/getAllRejectedCampains', protect, authorize('ADMIN'), auditLog('Access rejected campains'), getAllRejectedCampains);
//================================
//campain management
//================================
router.get('/getAllCampains', protect, authorize('ADMIN'), auditLog('Access campains'), getAllCampains);
router.get('/getCampainById/:id', protect, authorize('ADMIN'), auditLog('Access campain'), getCampainById);
router.put('/updateCampain/:id',upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 10 }]), processImage, uploadErrorHandler,authorize('ADMIN'), auditLog('Update Campaign by admin'), updateCampain);
router.delete('/deleteCampain/:id',authorize('ADMIN'), auditLog('Delete Campaign by admin'), deleteCampain);

//========================
//organizor verification management
//========================
router.get('/getAllVerifications', protect, authorize('ADMIN'), auditLog('Access verifications'), getAllVerifications);
router.get('/getVerificationById/:id', protect, authorize('ADMIN'), auditLog('Access verification'), getVerificationById);
router.put('/updateVerification/:id', protect, authorize('ADMIN'), auditLog('Update verification'), updateVerification);
router.delete('/deleteVerification/:id', protect, authorize('ADMIN'), auditLog('Delete verification'), deleteVerification);

//========================
//donation management
//========================
router.get('/getAllDonations', protect, authorize('ADMIN'), auditLog('Access donations'), getAllDonations);
router.get('/getDonationById/:id', protect, authorize('ADMIN'), auditLog('Access donation'), getDonationById);
router.put('/updateDonation/:id', protect, authorize('ADMIN'), auditLog('Update donation'), updateDonation);
router.delete('/deleteDonation/:id', protect, authorize('ADMIN'), auditLog('Delete donation'), deleteDonation);

//========================
//audit log management
//========================
router.get('/getAllAuditLogs', protect, authorize('ADMIN'), auditLog('Access audit logs'), getAllAuditLogs);
router.get('/getAuditLogById/:id', protect, authorize('ADMIN'), auditLog('Access audit log'), getAuditLogById);
router.delete('/deleteAuditLog/:id', protect, authorize('ADMIN'), auditLog('Delete audit log'), deleteAuditLog);




module.exports = router;