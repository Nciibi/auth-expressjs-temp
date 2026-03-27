const QrSession = require('../models/QrSession');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a new QR session in pending state
 */
const createSession = async () => {
    const sessionId = uuidv4();
    const session = new QrSession({
        sessionId,
        status: 'pending'
    });
    
    await session.save();
    return session;
};

/**
 * Validates if a session exists, is pending, and hasn't expired.
 */
const validateSessionForScan = async (sessionId) => {
    const session = await QrSession.findOne({ sessionId });
    
    if (!session) {
        return { success: false, message: 'Session not found' };
    }
    
    // Check if expired based on virtual or real time logic
    // Even if TTL didn't run yet, we enforce 2 min limit strictly
    const isExpired = new Date() > new Date(session.createdAt.getTime() + 120000);
    
    if (isExpired) {
        session.status = 'expired';
        await session.save();
        return { success: false, message: 'Session expired' };
    }
    
    if (session.status !== 'pending') {
        return { success: false, message: `Session already ${session.status}` };
    }

    return { success: true, session };
};

/**
 * Approves a session by attaching user info and changing status
 */
const approveSession = async (sessionId, userId, userModel) => {
    // Re-validate to prevent race conditions
    const validation = await validateSessionForScan(sessionId);
    if (!validation.success) {
         return validation;
    }

    const session = validation.session;
    session.status = 'authenticated';
    session.userId = userId;
    session.userModel = userModel;
    await session.save();

    return { success: true, session };
};

/**
 * Marks session as used
 */
const markSessionAsUsed = async (sessionId) => {
     await QrSession.updateOne(
        { sessionId },
        { status: 'used' }
    );
}

module.exports = {
    createSession,
    validateSessionForScan,
    approveSession,
    markSessionAsUsed
};
