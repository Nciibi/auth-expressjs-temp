const jwt = require('jsonwebtoken');

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';
const REFRESH_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues an access and refresh token pair
 * @param {Object} payload - Data to be encoded (e.g., { id, role })
 * @returns {Object} { accessToken, refreshToken }
 */
const issuePair = (payload) => {
    const accessToken = jwt.sign(
        { ...payload, type: 'access' }, 
        process.env.JWT_SECRET, 
        { expiresIn: ACCESS_EXPIRES }
    );
    const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' }, 
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, 
        { expiresIn: REFRESH_EXPIRES }
    );
    return { accessToken, refreshToken };
};

/**
 * Standardizes the cookie configuration for refresh tokens
 * @param {Object} res - Express response object
 * @param {string} refreshToken - The refresh token string
 */
const setRefreshCookie = (res, refreshToken) => {
    res.cookie('jwt', refreshToken, {
        httpOnly: true, // accessible only by web server
        secure: process.env.NODE_ENV === 'production', // https
        sameSite: 'None', // cross-site cookie
        maxAge: REFRESH_COOKIE_MS // 7 days
    });
};

module.exports = {
    issuePair,
    setRefreshCookie,
    ACCESS_EXPIRES,
    REFRESH_EXPIRES,
    REFRESH_COOKIE_MS
};
