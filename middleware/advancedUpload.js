const multer = require('multer');
const { processImage } = require('../services/imageService');
const AppError = require('../utils/AppError');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
        ];
        if (!allowed.includes(file.mimetype)) {
            return cb(new AppError('Only images (JPEG, PNG, WebP, GIF, AVIF) are allowed', 400), false);
        }
        cb(null, true);
    }
});

const processImageMiddleware = async (req, res, next) => {
    try {
        if (!req.file) return next();

        const oldImageUrl = req.body?.oldImageUrl || req.user?.photo;

        const result = await processImage(req.file.buffer, { oldImageUrl });

        req.uploadedFile = {
            url: result.variants.full.url,
            thumbnailUrl: result.variants.thumb?.url || null,
            avifUrl: result.variants.avif?.url || null,
            hash: result.hash,
            size: result.variants.full.size,
            variants: result.variants,
        };

        next();
    } catch (err) {
        if (err.code === 'FILE_TOO_LARGE') {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err.code === 'INVALID_IMAGE') {
            return res.status(400).json({ success: false, message: 'Invalid image content' });
        }
        next(err);
    }
};

const uploadErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large (5MB max)' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: `Unexpected field: ${err.field}. Use 'image' for the file field.` });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }

    if (err.isOperational) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }

    next(err);
};

module.exports = {
    upload,
    processImage: processImageMiddleware,
    uploadErrorHandler,
};
