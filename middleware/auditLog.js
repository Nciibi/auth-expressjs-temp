const AuditLog = require('../models/AuditLog');
const { auditLogger } = require('../utils/logger');

/**
 * Middleware to log admin/sensitive actions to both DB and File
 * @param {string} actionDescription - Human readable description of the action
 */
const auditLog = (actionDescription) => {
    return async (req, res, next) => {
        const originalSend = res.send;

        // Wrap res.send to capture the response and log it
        res.send = function (data) {
            res.send = originalSend;
            const response = res.send(data);
            
            // Log only if it was an intentional action (usually non-GET or specific GET)
            // We use setImmediate to not block the response
            setImmediate(async () => {
                try {
                    const logData = {
                        userId: req.userId || (req.user ? req.user._id : null),
                        userModel: req.userRole ? req.userRole.toLowerCase() : null,
                        action: actionDescription || `${req.method} ${req.originalUrl}`,
                        resource: req.originalUrl,
                        ip: req.ip || req.connection.remoteAddress,
                        userAgent: req.headers['user-agent'],
                        status: res.statusCode,
                        details: req.method !== 'GET' ? req.body : req.query,
                        timestamp: new Date()
                    };

                    // 1. Log to Database
                    await AuditLog.create(logData);

                    // 2. Log to File
                    auditLogger.info(logData);
                } catch (error) {
                    console.error('Audit Logging Error:', error);
                }
            });

            return response;
        };

        next();
    };
};

module.exports = auditLog;
