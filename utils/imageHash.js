const crypto = require('crypto');

/**
 * Generates a SHA-256 hash of an image buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {string} - Hex string of the hash
 */
const hashBuffer = (buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = {
    hashBuffer
};
