const AppError = require('../utils/AppError');
const AuditLog = require('../models/AuditLog');
const { errorFileLogger } = require('../utils/logger');

function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'credential', 'authorization'];
    for (const field of sensitiveFields) {
        if (sanitized[field]) sanitized[field] = '***REDACTED***';
    }
    return sanitized;
}

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || err.status || 500;
    const severity = err.severity ?? 9;
    const severityLabel = err.getSeverityLabel?.() ?? 'CRITICAL';

    const logPayload = {
        severity: `${severity}/10`,
        severityLabel,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection?.remoteAddress,
        userId: req.userId || (req.user?._id) || null,
        userRole: req.userRole || null,
        userAgent: req.headers['user-agent'],
        body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
        errorMessage: err.message,
        stack: err.stack,
        status: statusCode,
        isOperational: err.isOperational || false,
    };

    // Log to file with severity-differentiated level
    if (severity >= 7) {
        errorFileLogger.error(logPayload, `[${severityLabel}]`);
    } else if (severity >= 5) {
        errorFileLogger.warn(logPayload, `[${severityLabel}]`);
    } else {
        errorFileLogger.info(logPayload, `[${severityLabel}]`);
    }

    // Log to AuditLog DB asynchronously
    setImmediate(async () => {
        try {
            await AuditLog.create({
                userId: logPayload.userId,
                userModel: logPayload.userRole?.toLowerCase() || null,
                action: `ERROR:${severityLabel}:${err.constructor.name}`,
                resource: logPayload.url,
                details: {
                    message: err.message,
                    status: statusCode,
                    severity: `${severity}/10`,
                    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                },
                ip: logPayload.ip,
                userAgent: logPayload.userAgent,
                status: statusCode,
            });
        } catch (auditError) {
            console.error('Failed to write error to AuditLog:', auditError.message);
        }
    });

    // Send response
    res.status(statusCode).json({
        success: false,
        message: err.isOperational ? err.message : 'Internal server error',
        severity: `${severity}/10`,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
        }),
    });
}

module.exports = errorHandler;
