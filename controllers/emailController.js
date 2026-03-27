const crypto = require('crypto');
const VerificationCode = require('../models/VerificationCode');
const { sendVerificationEmail, emailRateLimiter } = require('../services/emailService');

// Generate secure random code
const generateVerificationCode = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Add rate limiter to the routes
const sendCode = [
    emailRateLimiter,
    async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, message: 'Email is required' });
            }

            const emailLower = email.trim().toLowerCase();

            // Start sending email before database operations
            const code = generateVerificationCode();
            const emailPromise = sendVerificationEmail(emailLower, code);

            // While email is sending, prepare the database
            const codeHash = crypto
                .createHash('sha256')
                .update(code + emailLower)
                .digest('hex');

            // Delete any existing codes for this email
            await VerificationCode.deleteOne({ email: emailLower });

            // Create new verification code
            await VerificationCode.create({
                email: emailLower,
                code: codeHash
            });

            // Wait for email to complete
            await emailPromise;

            return res.status(200).json({
                success: true,
                message: 'Verification code sent successfully'
            });
        } catch (error) {
            console.error('Send code error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification code',
                error: error.message
            });
        }
    }
];

const verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email and code are required'
            });
        }

        const emailLower = email.trim().toLowerCase();

        // Hash the received code for comparison
        const receivedCodeHash = crypto
            .createHash('sha256')
            .update(code + emailLower)
            .digest('hex');

        // Find the verification code using the hash
        const verificationCode = await VerificationCode.findOne({
            email: emailLower,
            code: receivedCodeHash
        });

        if (!verificationCode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // Check if code is expired (10 minutes)
        const now = new Date();
        const codeAge = now - verificationCode.createdAt;
        const tenMinutes = 10 * 60 * 1000;

        if (codeAge > tenMinutes) {
            await VerificationCode.deleteOne({ _id: verificationCode._id });
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired'
            });
        }

        // Delete the used code
        await VerificationCode.deleteOne({ _id: verificationCode._id });

        res.status(200).json({
            success: true,
            message: 'Code verified successfully'
        });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify code'
        });
    }
};

const getVerificationStatus = async (req, res) => {
    try {
        const { email } = req.params;

        // Check if there's a pending verification code
        const verificationCode = await VerificationCode.findOne({ email: email.toLowerCase() });

        res.json({
            success: true,
            isVerified: !verificationCode, // If no code exists, consider it verified
            message: verificationCode ? 'Verification pending' : 'Email verified'
        });
    } catch (error) {
        console.error('Error checking verification status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check verification status'
        });
    }
};

module.exports = {
    sendCode,
    verifyCode,
    getVerificationStatus
};
