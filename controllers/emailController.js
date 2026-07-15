const crypto = require('crypto');
const VerificationCode = require('../models/VerificationCode');
const { sendVerificationEmail, emailRateLimiter } = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const generateVerificationCode = () => {
    return crypto.randomInt(100000, 999999).toString();
};

const sendCode = [
    emailRateLimiter,
    asyncHandler(async (req, res) => {
        const { email } = req.body;
        if (!email) {
            throw new AppError('Email is required', 400, 3);
        }

        const emailLower = email.trim().toLowerCase();

        const code = generateVerificationCode();
        const emailPromise = sendVerificationEmail(emailLower, code);

        const codeHash = crypto
            .createHash('sha256')
            .update(code + emailLower)
            .digest('hex');

        await VerificationCode.deleteOne({ email: emailLower });

        await VerificationCode.create({
            email: emailLower,
            code: codeHash
        });

        await emailPromise;

        return res.status(200).json({
            success: true,
            message: 'Verification code sent successfully'
        });
    })
];

const verifyCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new AppError('Email and code are required', 400, 3);
    }

    const emailLower = email.trim().toLowerCase();

    const receivedCodeHash = crypto
        .createHash('sha256')
        .update(code + emailLower)
        .digest('hex');

    const verificationCode = await VerificationCode.findOne({
        email: emailLower,
        code: receivedCodeHash
    });

    if (!verificationCode) {
        throw new AppError('Invalid or expired verification code', 400, 4);
    }

    const now = new Date();
    const codeAge = now - verificationCode.createdAt;
    const tenMinutes = 10 * 60 * 1000;

    if (codeAge > tenMinutes) {
        await VerificationCode.deleteOne({ _id: verificationCode._id });
        throw new AppError('Verification code has expired', 400, 4);
    }

    await VerificationCode.deleteOne({ _id: verificationCode._id });

    res.status(200).json({
        success: true,
        message: 'Code verified successfully'
    });
});

const getVerificationStatus = asyncHandler(async (req, res) => {
    const { email } = req.params;

    const verificationCode = await VerificationCode.findOne({ email: email.toLowerCase() });

    res.json({
        success: true,
        isVerified: !verificationCode,
        message: verificationCode ? 'Verification pending' : 'Email verified'
    });
});

module.exports = {
    sendCode,
    verifyCode,
    getVerificationStatus
};
