// ------------------------------------------------------------------
// AUTHORIZE MIDDLEWARE
// ------------------------------------------------------------------
// Grants access to specific roles only.
// Should be used AFTER an authentication middleware (like middleware.auth)
// that attaches the user object (or at least `user.role`) to `req.user`.

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userId || !roles.includes(req.userRole.toUpperCase())) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.userRole}' is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = authorize;
