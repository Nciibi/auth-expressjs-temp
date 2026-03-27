const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const {
    registerDonator,
    registerOrganizer,
    verifyEmailCode,
    resendVerification,
    login,
    googleLogin,
    forgotPassword,
    resetPassword,
    logout,
    setupMfa,
    verifyMfa,
    disableMfa,
    verifyLoginMfa
} = require('../controllers/authController');

const {
    sendCode,
    verifyCode,
    getVerificationStatus
} = require('../controllers/emailController');

const loginLimiter = require('../middleware/loginLimiter');
const { upload, processImage, uploadErrorHandler } = require('../middleware/advancedUpload');
const authorize = require('../middleware/authorize');
const auditLog = require('../middleware/auditLog');
const verifyJWT = require('../middleware/verifyJWT');

const loadUser = require('../middleware/loadUser');
const { registerSchema, loginSchema, resetPasswordSchema, verifyEmailSchema } = require('../utils/validationSchemas');

const protect = [verifyJWT, loadUser];

/**
 * Dispatcher middleware to "aim" registration at the correct handler
 */
const dispatchRegister = (req, res, next) => {
    const role = (req.body.role || '').trim().toLowerCase();
    if (role === 'organizer') {
        return registerOrganizer(req, res);
    }
    // Default or explicitly donator
    return registerDonator(req, res);
};

// ========================
// Authentication Core
// ========================

// Registration with Profile image upload support (Multer + Sharp)
router.post('/register',upload.single('image'),processImage,uploadErrorHandler,validate(registerSchema),
    auditLog('User Registration Initiated'),
    dispatchRegister
);

router.post('/login', loginLimiter, validate(loginSchema), auditLog('User Login Attempt'), login);

// OAuth Handler
router.post('/google-login', loginLimiter, auditLog('Google OAuth Login'), googleLogin);






// ========================
// Password Management
// ========================

router.post('/forgot-password', auditLog('Forgot Password Requested'), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), auditLog('Password Reset Finalized'), resetPassword);






// ========================
// Email Verification
// ========================

// 1. In-memory Registration Flow Verifications
router.post('/verify-registration-email', validate(verifyEmailSchema), verifyEmailCode);
router.post('/resend-registration-verification', resendVerification);

// 2. DB-backed Verification (Standalone, ideal for 2FA or updating emails)
router.post('/send-code', sendCode);
router.post('/verify-code', verifyCode);
router.get('/verification-status/:email', getVerificationStatus);







// ========================
// Token Management
// ========================


router.post('/logout', logout);





// ========================
// Sample Admin Route
// ========================
router.get('/admin/dashboard', protect, authorize('ADMIN'), auditLog('Access Admin Dashboard'), (req, res) => {
    res.json({ success: true, message: 'Welcome to the admin dashboard!' });
});





// ========================
// Multi-Factor Auth (MFA)
// ========================
router.post('/mfa/setup', protect, auditLog('MFA Setup Initiated'), setupMfa);
router.post('/mfa/verify', protect, auditLog('MFA Verified/Enabled'), verifyMfa);
router.post('/mfa/disable', protect, auditLog('MFA Disabled'), disableMfa);
router.post('/mfa/verify-login', auditLog('MFA Login Verification'), verifyLoginMfa);

module.exports = router;
