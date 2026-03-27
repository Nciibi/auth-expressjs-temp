// utils/errorLoggerMiddleware.js
// Basic error logging middleware implementation

/**
 * Sanitize request body (remove passwords, tokens, etc.)
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'credential'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    }

    return sanitized;
}

const AuditLog = require('../models/AuditLog');
const { errorFileLogger } = require('../utils/logger');

/**
 * Main error logger middleware factory
 */
function errorLoggerMiddleware(options = {}) {
    const { area = 'auth', operation = null } = options;

    return (err, req, res, next) => {
        const statusCode = err.status || err.statusCode || 500;
        
        // Build context
        const logContext = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent'],
            body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
            area,
            operation,
            errorMessage: err.message,
            stack: err.stack,
            status: statusCode
        };

        // 1. Log to file
        errorFileLogger.error(logContext);

        // 2. Log to Database (Audit)
        // Use setImmediate to avoid blocking the error response
        setImmediate(async () => {
            try {
                await AuditLog.create({
                    userId: req.userId || (req.user?._id) || null,
                    userModel: req.userRole?.toLowerCase() || null,
                    action: `SYSTEM_ERROR: ${operation || 'Uncaught'}`,
                    resource: logContext.url,
                    details: {
                        message: err.message,
                        status: statusCode,
                        area
                    },
                    ip: logContext.ip,
                    userAgent: logContext.userAgent,
                    status: statusCode
                });
            } catch (auditError) {
                console.error('Error logging to AuditLog DB:', auditError);
            }
        });

        next(err);
    };
}

const middleware = {
    log: () => errorLoggerMiddleware(),
    api: (options = {}) => errorLoggerMiddleware({ area: 'api', ...options }),
    auth: (options = {}) => errorLoggerMiddleware({ area: 'auth', ...options }),
};

module.exports = {
    errorLoggerMiddleware,
    middleware
};
