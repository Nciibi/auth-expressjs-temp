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

const getModel = (role) => {
    switch (role?.toUpperCase()) {
        case 'DONATOR': return Donator;
        case 'ORGANIZER': return Organizer;
        default: return Donator; // Default fallback
    }
};



// Setup Google Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Issue pair and setRefreshCookie moved to utils/tokenUtils.js

const register = async (req, res, forcedRole) => {
    try {
        const { name, email, password, phoneNumber } = req.body;
        const role = forcedRole || req.body.role;

        const emailLower = email.trim().toLowerCase();
        const roleLower = role.trim().toLowerCase();

        // Check if user exists in any collection
        const existingAdmin = await Admin.findOne({ email: emailLower });
        const existingDonator = await Donator.findOne({ email: emailLower });
        const existingOrganizer = await Organizer.findOne({ email: emailLower });

        if (existingAdmin || existingDonator || existingOrganizer) {
            return res.status(409).json({ success: false, message: 'Email already in use' });
        }

        // Hash password
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

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
    }
};

const registerDonator = (req, res) => register(req, res, 'donator');
const registerOrganizer = (req, res) => register(req, res, 'organizer');

const verifyEmailCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Email and code are required' });
        }

        const result = await verifyA2f(email.toLowerCase(), code);

        if (result.success) {
            // Create user after successful verification
            const Model = getModel(result.data.role);
            const newUser = await Model.create(result.data);
            const cookies = req.cookies;
            let newRefreshTokens = !cookies?.jwt ? newUser.refreshTokens || [] : (newUser.refreshTokens || []).filter(rt => rt !== cookies.jwt);

            if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

            const { accessToken, refreshToken } = issuePair({ id: newUser._id, role: newUser.role });

            // Prune refresh tokens (max 5 devices/sessions)
            newRefreshTokens = (newRefreshTokens || []).slice(-4);
            newRefreshTokens.push(refreshToken);

            newUser.refreshTokens = newRefreshTokens;
            newUser.usedRefreshTokens = []; // Fresh session
            await newUser.save();

            setRefreshCookie(res, refreshToken);
            return res.status(201).json({ success: true, message: 'Account verified and created successfully', userinfo: newUser, accessToken: accessToken,refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_EXPIRES });
        }

        return res.status(400).json(result);
    } catch (error) {
        console.error('Verify email error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const result = await handleResendVerification(email.toLowerCase());
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Resend verification error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        console.log("email, password, role",email, password, role)
        const emailLower = email.trim().toLowerCase();

        let Model;
        let user;

        if (role) {
            Model = getModel(role);
            user = await Model.findOne({ email: emailLower });
        } else {
            // Search all models if role not provided
            user = await Admin.findOne({ email: emailLower }) ||
                await Donator.findOne({ email: emailLower }) ||
                await Organizer.findOne({ email: emailLower });
        }

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.isGoogleAuth) {
            return res.status(400).json({ success: false, message: 'This account uses Google Sign-In. Please login with Google.' });
        }

        // --- ACCOUNT LOCKOUT LOGIC ---
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(403).json({ success: false, message: 'Account is locked. Try again later.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 mins
            }
            await user.save();
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();
        user.lastIp = req.ip || req.connection.remoteAddress;

        const parser = new UAParser(req.headers['user-agent']);
        const { browser, os, device } = parser.getResult();
        user.deviceInfo = `${os.name || 'Unknown OS'} - ${browser.name || 'Unknown Browser'} ${device.type ? `(${device.type})` : ''}`;

        await user.save();

        // --- MFA LOGIC ---
        if (user.isMfaEnabled) {
            const mfaToken = jwt.sign({ id: user._id, mfaRequired: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
            return res.status(200).json({
                success: true,
                message: 'MFA required',
                mfaRequired: true,
                mfaToken
            });
        }

        // --- REFRESH TOKEN ROTATION ---
        const cookies = req.cookies;
        let newRefreshTokens = !cookies?.jwt ? user.refreshTokens || [] : (user.refreshTokens || []).filter(rt => rt !== cookies.jwt);

        if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

        const { accessToken, refreshToken } = issuePair({ id: user._id, role: user.role });

        // Prune refresh tokens (max 5 devices/sessions)
        newRefreshTokens = (newRefreshTokens || []).slice(-4);
        newRefreshTokens.push(refreshToken);

        user.refreshTokens = newRefreshTokens;
        user.usedRefreshTokens = []; // Clear on fresh login
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

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const googleLogin = async (req, res) => {
    try {
        const { credential, role } = req.body;

        if (!credential) {
            return res.status(400).json({ success: false, message: 'Google credential is required' });
        }

        // Verify token
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
            return res.status(400).json({ success: false, message: 'Missing Google profile fields' });
        }

        if (!emailVerified) {
            return res.status(400).json({ success: false, message: 'Google email not verified' });
        }

        // Search all models for the Google user
        const existingUser = await Donator.findOne({ email }) ||
            await Organizer.findOne({ email });

        if (existingUser) {
            // Account exists, but check if they normally use a password
            if (!existingUser.isGoogleAuth) {
                return res.status(409).json({ success: false, message: 'An account with this email already exists. Please login with your password.' });
            }

            // Update their picture if we don't have one
            if (!existingUser.photo && picture) {
                existingUser.photo = picture;
                await existingUser.save();
            }

            // Login success
            const { accessToken, refreshToken } = issuePair({ id: existingUser._id, role: existingUser.role });

            // Handle refresh token rotation/pruning for Google login
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

        // Otherwise, create a NEW user via Google (default to donator or based on some param)
        // For template, default to Donator
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

    } catch (err) {
        console.error('Google verification failed:', err);
        return res.status(401).json({ success: false, message: 'Invalid Google credential' });
    }
};




const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        // Search all models for the email
        const user = await Donator.findOne({ email: email.toLowerCase() }) ||
            await Organizer.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({ success: false, message: "No account found with that email" });
        }

        if (user.isGoogleAuth) {
            return res.status(400).json({ success: false, message: "Password reset not allowed for Google-authenticated accounts" });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        await sendResetPasswordEmail(user.email, resetUrl);

        return res.status(200).json({ success: true, message: 'Password reset link sent' });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Since we don't know the role from the token, search all
        const query = {
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        };
        const user = await Donator.findOne(query) ||
            await Organizer.findOne(query);

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        await sendResetPasswordConfirmationEmail(user.email);

        res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};





const refresh = async (req, res) => {
    const cookies = req.cookies;

    // Support refresh token from body (mobile) or cookie (web)
    const refreshToken = req.body?.refreshToken || req.headers['x-refresh-token'] || cookies?.jwt;

    if (!refreshToken) return res.status(401).json({ message: 'Unauthorized: No refresh token' });

    // Only clear cookie if one was actually sent
    if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    // 1. Look for token in active refresh tokens
    let user = await Admin.findOne({ refreshTokens: refreshToken }) ||
        await Donator.findOne({ refreshTokens: refreshToken }) ||
        await Organizer.findOne({ refreshTokens: refreshToken });

    const gracePeriod = 60 * 1000; // 60-second grace for rotation race conditions

    // 2. If not in active, check if it was recently rotated (Grace Period)
    if (!user) {
        user = await Admin.findOne({ "usedRefreshTokens.token": refreshToken }).select('+email +refreshTokens +usedRefreshTokens') ||
            await Donator.findOne({ "usedRefreshTokens.token": refreshToken }).select('+email +refreshTokens +usedRefreshTokens') ||
            await Organizer.findOne({ "usedRefreshTokens.token": refreshToken }).select('+email +refreshTokens +usedRefreshTokens');
        
    ;
        if (user) {
            const usedTokenEntry = user.usedRefreshTokens.find(rt => rt.token === refreshToken);
            if (usedTokenEntry && (Date.now() - usedTokenEntry.usedAt) < gracePeriod) {
                // Legitimate race condition — return a new access token without failing
                const accessToken = jwt.sign(
                    { id: user._id, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: ACCESS_EXPIRES }
                );
                // Don't rotate again to avoid refresh storms.
                // Browser already has the latest refresh token from the first successful request.
                return res.json({ success: true, accessToken });
            }
        }

        // 3. Token reuse detected / possible hijack attempt — nuke all tokens
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            async (err, decoded) => {
                if (err || decoded?.type !== 'refresh') return;
                const hackedUser = await Admin.findById(decoded.id) ||
                    await Donator.findById(decoded.id) ||
                    await Organizer.findById(decoded.id);
                if (hackedUser) {
                    hackedUser.refreshTokens = [];
                    hackedUser.usedRefreshTokens = [];
                    await hackedUser.save();
                }
            }
        );
        return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }

    // 4. Token found in active — perform rotation
    const newRefreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
        async (err, decoded) => {
            if (err || decoded?.type !== 'refresh') {
                user.refreshTokens = newRefreshTokens;
                await user.save();
                return res.status(403).json({ message: 'Forbidden' });
            }

            if (user._id.toString() !== decoded.id) {
                return res.status(403).json({ message: 'Forbidden' });
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

            // Limit active refresh tokens to 5 (prune oldest)
            const prunedActive = newRefreshTokens.slice(-4);
            user.refreshTokens = [...prunedActive, newRefreshToken];

            // Move used token to usedRefreshTokens, keep only within grace period
            user.usedRefreshTokens = [
                ...(user.usedRefreshTokens || []).filter(rt => (Date.now() - rt.usedAt) < gracePeriod),
                { token: refreshToken, usedAt: Date.now() }
            ];

            await user.save();

            // Set cookie for web clients
            setRefreshCookie(res, newRefreshToken);

            // Return both tokens in body for mobile clients
            console.log(user);
            return res.json({
                success: true,
                accessToken,
                refreshToken: newRefreshToken
            });
        }
    );
};

const logout = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); // No content
    const refreshToken = cookies.jwt;

    // Is token in DB?
    const user = await Admin.findOne({ refreshTokens: refreshToken }) ||
        await Donator.findOne({ refreshTokens: refreshToken }) ||
        await Organizer.findOne({ refreshTokens: refreshToken });
    if (user) {
        user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
        await user.save();
    }

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
    res.json({ message: 'Cookie cleared' });
};






const setupMfa = async (req, res) => {
    try {
        const Model = getModel(req.userRole);
        const user = await Model.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const secret = authenticator.generateSecret();
        const otpauthContent = authenticator.keyuri(user.email, 'Auth-Microservice', secret);
        const qrCodeDataUrl = await qrcode.toDataURL(otpauthContent);

        user.mfaSecret = secret;
        await user.save();

        res.json({ secret, qrCode: qrCodeDataUrl });
    } catch (error) {
        res.status(500).json({ message: 'MFA setup failed' });
    }
};

const verifyMfa = async (req, res) => {
    try {
        const { token } = req.body;
        const Model = getModel(req.userRole || req.user?.role);
        const user = await Model.findById(req.userId || req.user?.id);
        if (!user || (!user.mfaSecret && !user.isMfaEnabled)) return res.status(400).json({ message: 'MFA not initialized' });

        const isValid = authenticator.verify({ token, secret: user.mfaSecret });
        if (!isValid) return res.status(400).json({ message: 'Invalid MFA token' });

        user.isMfaEnabled = true;
        await user.save();

        res.json({ success: true, message: 'MFA enabled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const disableMfa = async (req, res) => {
    try {
        const { token } = req.body;
        const Model = getModel(req.userRole || req.user?.role);
        const user = await Model.findById(req.userId || req.user?.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = authenticator.verify({ token, secret: user.mfaSecret });
        if (!isValid) return res.status(400).json({ message: 'Invalid MFA token' });

        user.mfaSecret = '';
        user.isMfaEnabled = false;
        await user.save();

        res.json({ success: true, message: 'MFA disabled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyLoginMfa = async (req, res) => {
    try {
        const { mfaToken, code } = req.body;

        let decoded;
        try {
            decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ message: 'Invalid or expired MFA token' });
        }

        if (!decoded.mfaRequired) return res.status(400).json({ message: 'MFA token invalid type' });

        const Model = getModel(decoded.role);
        const user = await Model.findById(decoded.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = authenticator.verify({ token: code, secret: user.mfaSecret });
        if (!isValid) return res.status(400).json({ message: 'Invalid MFA code' });

        const cookies = req.cookies;
        let newRefreshTokens = !cookies?.jwt ? user.refreshTokens || [] : (user.refreshTokens || []).filter(rt => rt !== cookies.jwt);

        if (cookies?.jwt) res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

        const { accessToken, refreshToken } = issuePair({ id: user._id, role: user.role });

        // Prune refresh tokens (max 5)
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
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

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
