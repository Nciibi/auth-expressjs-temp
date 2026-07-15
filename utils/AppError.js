class AppError extends Error {
    constructor(message, statusCode = 500, severity = null, context = {}) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.context = context;

        // Auto-assign severity based on status code if not provided
        this.severity = severity ?? this.inferSeverity(statusCode);

        Error.captureStackTrace(this, this.constructor);
    }

    inferSeverity(statusCode) {
        if (statusCode >= 500) return 9;
        if (statusCode === 429) return 6;
        if (statusCode === 403 || statusCode === 401) return 5;
        if (statusCode === 409) return 4;
        if (statusCode >= 400) return 3;
        return 5;
    }

    getSeverityLabel() {
        if (this.severity >= 9) return 'CRITICAL';
        if (this.severity >= 7) return 'HIGH';
        if (this.severity >= 5) return 'MODERATE';
        if (this.severity >= 3) return 'LOW';
        return 'INFO';
    }
}

module.exports = AppError;
