const bcrypt = require('bcryptjs');
const pendingRegistrations = require('./registrationStore');
const { sendVerificationEmail } = require('../services/emailService');

const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const handleRegistration = async (email, registrationData) => {
    try {
        const verificationCode = generateVerificationCode();
        const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

        const verificationData = {
            ...registrationData,
            verificationCode: hashedVerificationCode,
            verificationExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
            createdAt: new Date()
        };

        pendingRegistrations.set(email, verificationData);
        await sendVerificationEmail(email, verificationCode);

        return {
            success: true,
            message: 'Verification code sent to your email',
            data: { email }
        };
    } catch (error) {
        console.error('Registration verification error:', error);
        throw error;
    }
};

// Renamed from verifyA2f to be more generic in the template context
const verifyA2f = async (email, code) => {
    try {
        const registrationData = pendingRegistrations.get(email);
        if (!registrationData) {
            return { success: false, message: 'Registration data not found or expired' };
        }

        if (registrationData.verificationExpires < Date.now()) {
            pendingRegistrations.delete(email);
            return { success: false, message: 'Verification code expired' };
        }

        const isValidCode = await bcrypt.compare(code, registrationData.verificationCode);
        if (!isValidCode) {
            return { success: false, message: 'Invalid verification code' };
        }

        const { verificationCode, verificationExpires, ...cleanData } = registrationData;
        pendingRegistrations.delete(email);

        return {
            success: true,
            message: 'Email verified successfully',
            data: { ...cleanData, isVerified: true }
        };
    } catch (error) {
        console.error('Verification error:', error);
        throw error;
    }
};

const handleResendVerification = async (email) => {
    try {
        const registrationData = pendingRegistrations.get(email);
        if (!registrationData) {
            return { success: false, message: 'Registration data not found or expired' };
        }

        const verificationCode = generateVerificationCode();
        const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

        const updatedData = {
            ...registrationData,
            verificationCode: hashedVerificationCode,
            verificationExpires: Date.now() + 10 * 60 * 1000
        };

        pendingRegistrations.set(email, updatedData);
        await sendVerificationEmail(email, verificationCode);

        return { success: true, message: 'New verification code sent successfully' };
    } catch (error) {
        console.error('Resend verification error:', error);
        throw error;
    }
};

module.exports = {
    handleRegistration,
    verifyA2f, // Keeping name exported as-is so authController doesn't break
    handleResendVerification,
    pendingRegistrations
};
