/**
 * Basic buffer validation to ensure the uploaded file contains valid image headers
 * @param {Buffer} buffer - File buffer from Multer
 * @returns {boolean} - True if it matches common image magic numbers
 */
const validateImageBuffer = async (buffer) => {
    if (!buffer || buffer.length === 0) return false;

    // Read first 4 bytes (magic numbers)
    const magic = buffer.toString('hex', 0, 4);

    // common magic numbers:
    // jpeg/jpg: ffd8ffe0, ffd8ffe1, ffd8ffe2, ffd8ffe3, ffd8ffe8
    // png: 89504e47
    // gif: 47494638
    // webp: 52494646 (RIFF) - standard for webp

    if (magic.startsWith('ffd8')) return true; // JPEG
    if (magic === '89504e47') return true;     // PNG
    if (magic === '47494638') return true;     // GIF
    if (magic === '52494646') return true;     // WEBP / RIFF

    return false;
};

module.exports = {
    validateImageBuffer
};
