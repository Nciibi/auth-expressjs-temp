const validateEmail = (email) => {
    try {
        // Simple regex for email validation
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            return {
                isValid: false,
                reason: 'Invalid email address format'
            };
        }

        return {
            isValid: true,
            reason: null
        };
    } catch (error) {
        console.error('Email validation error:', error);
        return {
            isValid: true, // Default to true in case of error to prevent blocking
            reason: null
        };
    }
};

module.exports = validateEmail;
