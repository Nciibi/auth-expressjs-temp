/**
 * Middleware to verify that the registration role is valid and allowed.
 * Specifically prevents public registration of sensitive roles like 'ADMIN'.
 */
const validateRegisterRole = (req, res, next) => {
    const { role } = req.body;

    // Use 'donator' as default if not provided, but if provided, it must be valid
    const allowedRoles = ['donator', 'organizer'];

    if (role) {
        const roleLower = role.trim().toLowerCase();

        if (!allowedRoles.includes(roleLower)) {
            return res.status(403).json({
                success: false,
                message: `Registration as role '${role}' is not allowed via this endpoint.`
            });
        }

        // Normalize role for controller
        req.body.role = roleLower;
    } else {
        // Default role
        req.body.role = 'donator';
    }

    next();
};

module.exports = validateRegisterRole;
