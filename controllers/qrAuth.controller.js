const { createSession, validateSessionForScan, approveSession, markSessionAsUsed } = require('../services/qrAuth.service');
const QrSession = require('../models/QrSession');
const { getIo } = require('../sockets/qr.socket');

const { issuePair, ACCESS_EXPIRES } = require('../utils/tokenUtils');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const createQrSession = asyncHandler(async (req, res) => {
    const session = await createSession();

    res.status(201).json({
        success: true,
        sessionId: session.sessionId,
        qrUrl: `/auth/qr/scan/${session.sessionId}`,
        expiresAt: session.expiresAt
    });
});

const scanQrSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const validation = await validateSessionForScan(sessionId);

    if (!validation.success) {
        throw new AppError(validation.message || 'Invalid session', 400, 4);
    }

    res.status(200).json({
        success: true,
        message: 'Session is valid. Waiting for approval.',
        sessionId
    });
});

const approveQrLogin = asyncHandler(async (req, res) => {
    const { sessionId } = req.body || {};

    if (!sessionId) {
        throw new AppError('sessionId is required in request body', 400, 3);
    }

    const userId = req.userId || req.user?._id || req.user?.id;
    const userRole = req.userRole || req.user?.role || 'Donator';

    if (!userId) {
        throw new AppError('Unauthorized. Log in first to approve.', 401, 5);
    }

    const approval = await approveSession(sessionId, userId, userRole);

    if (!approval.success) {
        throw new AppError(approval.message || 'Approval failed', 400, 4);
    }

    const { accessToken, refreshToken } = issuePair({ id: userId, role: userRole });

    const io = getIo();
    io.to(sessionId).emit('qr:authenticated', {
        success: true,
        message: 'Login approved',
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_EXPIRES
    });

    await markSessionAsUsed(sessionId);

    res.status(200).json({
        success: true,
        message: 'Login approved successfully. PC will proceed automatically.'
    });
});

const getQrStatus = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await QrSession.findOne({ sessionId });

    if (!session) {
        throw new AppError('Session not found', 404, 4);
    }

    res.status(200).json({
        success: true,
        status: session.status
    });
});

module.exports = {
    createQrSession,
    scanQrSession,
    approveQrLogin,
    getQrStatus
};
