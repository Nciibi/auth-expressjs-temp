const jwt = require('jsonwebtoken');

const verifyJWT = async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    console.log("JWT VERIFY ERROR:", err.message); // <-- add this
                    reject(err);
                        }
                        else resolve(decoded);
                    });
                });
        if (decoded.type !== 'access') {
            return res.status(401).json({ success: false, message: 'Unauthorized: Not an access token' });
        }

        req.userId = decoded.id;
        req.userRole = decoded.role;
        
        next();
    } catch (err) {
        let message = 'Unauthorized: Invalid token';
        if (err.name === 'TokenExpiredError') {
            message = 'Unauthorized: Token has expired';
        }
        return res.status(401).json({ success: false, message });
    }
};

module.exports = verifyJWT;
