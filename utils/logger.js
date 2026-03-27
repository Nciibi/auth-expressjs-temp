const pino = require('pino');
const path = require('path');

// Configure standard logger for console
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        targets: [
            {
                target: 'pino/file',
                options: { destination: path.join(__dirname, '../logs/errorlogs/error.log') },
                level: 'error'
            },
            {
                target: 'pino/file',
                options: { destination: path.join(__dirname, '../logs/authlogs/audit.log') },
                level: 'info' // We can use it for general logs too, but we'll use a specific logger for audit
            }
        ]
    }
});

// Create specific loggers for Audit and Error (Optional, but cleaner)
const auditLogger = pino({
    level: 'info',
    transport: {
        target: 'pino/file',
        options: { destination: path.join(__dirname, '../logs/authlogs/audit.log') }
    }
});

const errorFileLogger = pino({
    level: 'error',
    transport: {
        target: 'pino/file',
        options: { destination: path.join(__dirname, '../logs/errorlogs/error.log') }
    }
});

module.exports = {
    logger,
    auditLogger,
    errorFileLogger
};
