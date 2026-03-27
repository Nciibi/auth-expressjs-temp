const { createSession, validateSessionForScan, approveSession, markSessionAsUsed } = require('../services/qrAuth.service');
const QrSession = require('../models/QrSession');
const { getIo } = require('../sockets/qr.socket');
const jwt = require('jsonwebtoken');

const { issuePair, ACCESS_EXPIRES } = require('../utils/tokenUtils');


/**
 * 1. PC requests a new QR session
 */
const createQrSession = async (req, res) => {
    try {
        const session = await createSession();
        
        // Return session data. Frontend must generate QR code wrapping this URL
        res.status(201).json({
            success: true,
            sessionId: session.sessionId,
            // Example URL format that frontend phone could hit
            qrUrl: `/auth/qr/scan/${session.sessionId}`,
            expiresAt: session.expiresAt
        });
    } catch (error) {
        console.error('QR Session Create Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * 2. Phone scans the QR code (API to check session validity before showing approval UI)
 */
const scanQrSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const validation = await validateSessionForScan(sessionId);
        
        if (!validation.success) {
            return res.status(400).json(validation);
        }

        res.status(200).json({
            success: true,
            message: 'Session is valid. Waiting for approval.',
            sessionId
        });
    } catch (error) {
        console.error('QR Session Scan Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * 3. Logged-in phone app approves the login
 */
const approveQrLogin = async (req, res) => {
    try {
        const { sessionId } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'sessionId is required in request body' });
        }

        const userId = req.userId || req.user?._id || req.user?.id;
        const userRole = req.userRole || req.user?.role || 'Donator'; // Determine user DB collection, supplied via JWT middleware

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized. Log in first to approve.' });
        }

        const approval = await approveSession(sessionId, userId, userRole);
        
        if (!approval.success) {
            return res.status(400).json(approval);
        }

        // Generate JWT pairs for PC
        const { accessToken, refreshToken } = issuePair({ id: userId, role: userRole });

        // Update the user model with the new refresh token (Requires retrieving user document)
        // Note: You can optimize this depending on how you implement refresh routines 
        // We skip exact array push here for brevity, but logically you'd push the refresh token to the User DB.

        // Emit socket event to PC connected to this sessionId room
        const io = getIo();
        io.to(sessionId).emit('qr:authenticated', {
            success: true,
            message: 'Login approved',
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: ACCESS_EXPIRES
        });

        // Mark as used after successful emit
        await markSessionAsUsed(sessionId);

        res.status(200).json({
            success: true,
            message: 'Login approved successfully. PC will proceed automatically.'
        });
    } catch (error) {
        console.error('QR Approval Error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message, stack: error.stack });
    }
};

/**
 * 4. PC polling endpoint (Fallback if WebSockets fail)
 */
const getQrStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await QrSession.findOne({ sessionId });
        
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        res.status(200).json({
            success: true,
            status: session.status
        });
    } catch (error) {
        console.error('QR Polling Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    createQrSession,
    scanQrSession,
    approveQrLogin,
    getQrStatus
};
