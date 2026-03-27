// ------------------------------------------------------------------
// ZOD VALIDATION MIDDLEWARE
// ------------------------------------------------------------------
// Validates incoming requests against a defined Zod schema.

const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req[property]);
            // Replace the request property with the stripped/validated data from Zod
            req[property] = parsed;
            next();
        } catch (err) {
            // Check if it's a Zod error
            if (err.errors && Array.isArray(err.errors)) {
                const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: messages
                });
            }
            // Fallback for other errors
            return res.status(400).json({
                success: false,
                message: 'Invalid request data'
            });
        }
    };
};

module.exports = validate;
