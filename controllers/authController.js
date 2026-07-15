const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const UAParser = require('ua-parser-js');

const Admin = require('../models/admin');
const Donator = require('../models/donator');
const Organizer = require('../models/organizer');

const { sendResetPasswordEmail, sendResetPasswordConfirmationEmail } = require('../services/emailService');
const { handleRegistration, verifyA2f, handleResendVerification } = require('../utils/verificationUtils');
const { issuePair, setRefreshCookie, ACCESS_EXPIRES, REFRESH_EXPIRES } = require('../utils/tokenUtils');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const getModel = (role) => {
    switch (role?.toUpperCase()) {
        case 'DONATOR': return Donator;
        case 'ORGANIZER': return Organizer;
        default: return Donator;
    }
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const findUserByEmail = async (email) => {
    return (
        await Admin.findOne({ email }) ||
        await Donator.findOne({ email }) ||
        await Organizer.findOne({ email })
    );
};

const findUserByRefreshToken = async (token) => {
    return (
        await Admin.findOne({ refreshTokens: token }) ||
        await Donator.findOne({ refreshTokens: token }) ||
        await Organizer.findOne({ refreshTokens: token })
    );
};

const findUserByUsedToken = async (token) => {
    return (
        await Admin.findOne({ "usedRefreshTokens.token": token }).select('+email +refreshTokens +usedRefreshTokens') ||
        await Donator.findOne({ "usedRefreshTokens.token": token }).select('+email +refreshTokens +usedRefreshTokens') ||
        await Organizer.findOne({ "usedRefreshTokens.token": token }).select('+email +refreshTokens +usedRefreshTokens')
    );
};

const findUserById = async (id) => {
    return (
        await Admin.findById(id) ||
        await Donator.findById(id) ||
        await Organizer.findById(id)
    );
};

const register = async (req, res, forcedRole) => {
    const { name, email, password, phoneNumber } = req.body;
    const role = forcedRole || req.body.role;

    const emailLower = email.trim().toLowerCase();
    const roleLower = role.trim().toLowerCase();

    const existing = await findUserByEmail(emailLower);
    if (existing) {
        throw new AppError('Email already in use', 409, 3);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const registrationData = {
        name: name.trim(),
        username: name.trim(),
        email: emailLower,
        password: hashedPassword,
        phoneNumber: phoneNumber || null,
        role: roleLower,
        photo: req.uploadedFile ? req.uploadedFile.url : null
    };

    const result = await handleRegistration(emailLower, registrationData);
    return res.status(201).json(result);
};

const registerDonator = asyncHandler((req, res) => register(req, res, 'donator'));
const registerOrganizer = asyncHandler((req, res) => register(req, res, 'organizer'));

const verifyEmailCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        throw new AppError('Email and code are required', 400, 3);
    }

    const result = await verifyA2f(email.toLowerCase(), code);
    if (!result.success) {
        throw new AppError(result.message || 'Verification failed', 400, 3);
    }

    const Model = getModel(result.data.role);
    const newUser = await Model.create(result.data);
    const cookies = req.cookies;
    let newRefreshTokens = !cookies?.jwt ? newUser.refreshTokens || [] : (newUser.refreshTokens || []).filter(rt => rt !== cookies.jwt);

    if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    const { accessToken, refreshToken } = issuePair({ id: newUser._id, role: newUser.role });

    newRefreshTokens = (newRefreshTokens || []).slice(-4);
    newRefreshTokens.push(refreshToken);

    newUser.refreshTokens = newRefreshTokens;
    newUser.usedRefreshTokens = [];
    await newUser.save();

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({ success: true, message: 'Account verified and created successfully', userinfo: newUser, accessToken: accessToken, refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_EXPIRES });
});

const resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new AppError('Email is required', 400, 3);
    }
    const result = await handleResendVerification(email.toLowerCase());
    if (!result.success) {
        throw new AppError(result.message || 'Failed to resend verification', 400, 3);
    }
    return res.status(200).json(result);
});

const login = asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;
    const emailLower = email.trim().toLowerCase();

    let user;
    if (role) {
        const Model = getModel(role);
        user = await Model.findOne({ email: emailLower });
    } else {
        user = await findUserByEmail(emailLower);
    }

    if (!user) {
        throw new AppError('Invalid credentials', 401, 5);
    }

    if (user.isGoogleAuth) {
        throw new AppError('This account uses Google Sign-In. Please login with Google.', 400, 4);
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
        throw new AppError('Account is locked. Try again later.', 403, 6);
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 15 * 60 * 1000;
        }
        await user.save();
        throw new AppError('Invalid credentials', 401, 5);
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.lastIp = req.ip || req.connection.remoteAddress;

    const parser = new UAParser(req.headers['user-agent']);
    const { browser, os, device } = parser.getResult();
    user.deviceInfo = `${os.name || 'Unknown OS'} - ${browser.name || 'Unknown Browser'} ${device.type ? `(${device.type})` : ''}`;

    await user.save();

    if (user.isMfaEnabled) {
        const mfaToken = jwt.sign({ id: user._id, mfaRequired: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
        return res.status(200).json({
            success: true,
            message: 'MFA required',
            mfaRequired: true,
            mfaToken
        });
    }

    const cookies = req.cookies;
    let newRefreshTokens = !cookies?.jwt ? user.refreshTokens || [] : (user.refreshTokens || []).filter(rt => rt !== cookies.jwt);

    if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    const { accessToken, refreshToken } = issuePair({ id: user._id, role: user.role });

    newRefreshTokens = (newRefreshTokens || []).slice(-4);
    newRefreshTokens.push(refreshToken);

    user.refreshTokens = newRefreshTokens;
    user.usedRefreshTokens = [];
    await user.save();

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
        success: true,
        message: 'Login successful',
        userinfo: user,
        refreshToken,
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_EXPIRES
    });
});

const googleLogin = asyncHandler(async (req, res) => {
    const { credential, role } = req.body;

    if (!credential) {
        throw new AppError('Google credential is required', 400, 3);
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() || {};
    const email = (payload.email || '').toLowerCase();
    const name = payload.name || `${payload.given_name} ${payload.family_name}`;
    const picture = payload.picture || '';
    const emailVerified = payload.email_verified !== false;

    if (!email || !name) {
        throw new AppError('Missing Google profile fields', 400, 3);
    }

    if (!emailVerified) {
        throw new AppError('Google email not verified', 400, 4);
    }

    const existingUser = await Donator.findOne({ email }) ||
        await Organizer.findOne({ email });

    if (existingUser) {
        if (!existingUser.isGoogleAuth) {
            throw new AppError('An account with this email already exists. Please login with your password.', 409, 4);
        }

        if (!existingUser.photo && picture) {
            existingUser.photo = picture;
            await existingUser.save();
        }

        const { accessToken, refreshToken } = issuePair({ id: existingUser._id, role: existingUser.role });

        let newRefreshTokens = (existingUser.refreshTokens || []).slice(-4);
        newRefreshTokens.push(refreshToken);
        existingUser.refreshTokens = newRefreshTokens;
        existingUser.usedRefreshTokens = [];
        await existingUser.save();

        setRefreshCookie(res, refreshToken);
        return res.status(200).json({
            success: true,
            message: 'Google login successful',
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: ACCESS_EXPIRES,
            userinfo: existingUser
        });
    }

    const randomPassword = `google-auth-${crypto.randomBytes(32).toString('hex')}`;
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    const newUser = await getModel(role).create({
        name,
        email,
        password: hashedPassword,
        photo: picture || null,
        isVerified: true,
        isGoogleAuth: true,
        role
    });

    const { accessToken, refreshToken } = issuePair({ id: newUser._id, role });

    newUser.refreshTokens = [refreshToken];
    newUser.usedRefreshTokens = [];
    await newUser.save();

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
        success: true,
        message: 'Google user created and logged in successfully',
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_EXPIRES,
        userinfo: newUser
    });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new AppError('Email is required', 400, 3);
    }

    const user = await Donator.findOne({ email: email.toLowerCase() }) ||
        await Organizer.findOne({ email: email.toLowerCase() });

    if (!user) {
        throw new AppError('No account found with that email', 404, 4);
    }

    if (user.isGoogleAuth) {
        throw new AppError('Password reset not allowed for Google-authenticated accounts', 400, 4);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendResetPasswordEmail(user.email, resetUrl);

    return res.status(200).json({ success: true, message: 'Password reset link sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        throw new AppError('Token and new password are required', 400, 3);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const query = {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    };
    const user = await Donator.findOne(query) ||
        await Organizer.findOne(query);

    if (!user) {
        throw new AppError('Invalid or expired token', 400, 4);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await sendResetPasswordConfirmationEmail(user.email);

    res.status(200).json({ success: true, message: 'Password reset successfully' });
});

const refresh = asyncHandler(async (req, res) => {
    const cookies = req.cookies;
    const refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'] || cookies?.jwt;

    if (!refreshToken) {
        throw new AppError('Unauthorized: No refresh token', 401, 5);
    }

    if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    let user = await findUserByRefreshToken(refreshToken);

    const gracePeriod = 60 * 1000;

    if (!user) {
        user = await findUserByUsedToken(refreshToken);

        if (user) {
            const usedTokenEntry = user.usedRefreshTokens.find(rt => rt.token === refreshToken);
            if (usedTokenEntry && (Date.now() - usedTokenEntry.usedAt) < gracePeriod) {
                const accessToken = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: ACCESS_EXPIRES }
                );
                return res.json({ success: true, accessToken });
            }
        }

        // Token reuse detected — nuke all tokens
        const decoded = await new Promise((resolve) => {
            jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
                (err, decoded) => resolve(err ? null : decoded)
            );
        });

        if (decoded?.type === 'refresh') {
            const hackedUser = await findUserById(decoded.id);
            if (hackedUser) {
                hackedUser.refreshTokens = [];
                hackedUser.usedRefreshTokens = [];
                await hackedUser.save();
            }
        }

        throw new AppError('Forbidden: Invalid token', 403, 8);
    }

    const newRefreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);

    const decoded = await new Promise((resolve) => {
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            (err, decoded) => resolve(err ? null : decoded)
        );
    });

    if (!decoded || decoded?.type !== 'refresh') {
        user.refreshTokens = newRefreshTokens;
        await user.save();
        throw new AppError('Forbidden', 403, 7);
    }

    if (user._id.toString() !== decoded.id) {
        throw new AppError('Forbidden', 403, 7);
    }

    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_EXPIRES }
    );
    const newRefreshToken = jwt.sign(
        { id: user._id, role: user.role, type: 'refresh' },
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
        { expiresIn: REFRESH_EXPIRES }
    );

    const prunedActive = newRefreshTokens.slice(-4);
    user.refreshTokens = [...prunedActive, newRefreshToken];

    user.usedRefreshTokens = [
        ...(user.usedRefreshTokens || []).filter(rt => (Date.now() - rt.usedAt) < gracePeriod),
        { token: refreshToken, usedAt: Date.now() }
    ];

    await user.save();

    setRefreshCookie(res, newRefreshToken);

    return res.json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken
    });
});

const logout = asyncHandler(async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        return res.sendStatus(204);
    }
    const refreshToken = cookies.jwt;

    const user = await findUserByRefreshToken(refreshToken);
    if (user) {
        user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
        await user.save();
    }

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
    res.json({ message: 'Cookie cleared' });
});

const setupMfa = asyncHandler(async (req, res) => {
    const Model = getModel(req.userRole);
    const user = await Model.findById(req.userId);
    if (!user) {
        throw new AppError('User not found', 404, 4);
    }

    const secret = authenticator.generateSecret();
    const otpauthContent = authenticator.keyuri(user.email, 'Auth-Microservice', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthContent);

    user.mfaSecret = secret;
    await user.save();

    res.json({ secret, qrCode: qrCodeDataUrl });
});

const verifyMfa = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const Model = getModel(req.userRole || req.user?.role);
    const user = await Model.findById(req.userId || req.user?.id);
    if (!user || (!user.mfaSecret && !user.isMfaEnabled)) {
        throw new AppError('MFA not initialized', 400, 4);
    }

    const isValid = authenticator.verify({ token, secret: user.mfaSecret });
    if (!isValid) {
        throw new AppError('Invalid MFA token', 400, 4);
    }

    user.isMfaEnabled = true;
    await user.save();

    res.json({ success: true, message: 'MFA enabled successfully' });
});

const disableMfa = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const Model = getModel(req.userRole || req.user?.role);
    const user = await Model.findById(req.userId || req.user?.id);
    if (!user) {
        throw new AppError('User not found', 404, 4);
    }

    const isValid = authenticator.verify({ token, secret: user.mfaSecret });
    if (!isValid) {
        throw new AppError('Invalid MFA token', 400, 4);
    }

    user.mfaSecret = '';
    user.isMfaEnabled = false;
    await user.save();

    res.json({ success: true, message: 'MFA disabled successfully' });
});

const verifyLoginMfa = asyncHandler(async (req, res) => {
    const { mfaToken, code } = req.body;

    let decoded;
    try {
        decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
    } catch (e) {
        throw new AppError('Invalid or expired MFA token', 401, 5);
    }

    if (!decoded.mfaRequired) {
        throw new AppError('MFA token invalid type', 400, 4);
    }

    const Model = getModel(decoded.role);
    const user = await Model.findById(decoded.id);
    if (!user) {
        throw new AppError('User not found', 404, 4);
    }

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
    if (!isValid) {
        throw new AppError('Invalid MFA code', 400, 4);
    }

    const cookies = req.cookies;
    let newRefreshTokens = !cookies?.jwt ? user.refreshTokens || [] : (user.refreshTokens || []).filter(rt => rt !== cookies.jwt);

    if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    const { accessToken, refreshToken } = issuePair({ id: user._id, role: user.role });

    newRefreshTokens = (newRefreshTokens || []).slice(-4);
    newRefreshTokens.push(refreshToken);

    user.refreshTokens = newRefreshTokens;
    user.usedRefreshTokens = [];
    await user.save();

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
        success: true,
        message: 'Login successful via MFA',
        userinfo: user,
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_EXPIRES
    });
});

module.exports = {
    registerDonator,
    registerOrganizer,
    verifyEmailCode,
    resendVerification,
    login,
    googleLogin,
    forgotPassword,
    resetPassword,
    refresh,
    logout,
    setupMfa,
    verifyMfa,
    disableMfa,
    verifyLoginMfa
};
