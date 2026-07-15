const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { fileTypeFromBuffer } = require('file-type');
const { getRedisClient } = require('../config/redis');
const { cleanupImage } = require('../utils/imageCleanup');
const storage = require('./storage/index');

const REDIS_HASH_PREFIX = 'img_hash:';
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const VARIANTS = {
    full: { width: 1600, height: 1600, quality: 80, suffix: '' },
    thumb: { width: 200, height: 200, quality: 70, suffix: '_thumb' },
};

const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB per variant
const MIN_QUALITY = 40;

const getDateDir = () => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
};

const hashBuffer = (buffer) =>
    crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * Deep-validate image buffer using file-type + magic bytes
 */
const validateImage = async (buffer) => {
    if (!buffer || buffer.length === 0) return null;
    if (buffer.length > 5 * 1024 * 1024) {
        const err = new Error('File too large (5MB max)');
        err.code = 'FILE_TOO_LARGE';
        throw err;
    }

    const type = await fileTypeFromBuffer(buffer);
    if (!type) return null;

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/tiff'];
    if (!allowedMimes.includes(type.mime)) return null;

    return type;
};

/**
 * Check if buffer is an animated GIF (multiple frames)
 */
const isAnimated = async (buffer) => {
    try {
        const metadata = await sharp(buffer, { animated: true }).metadata();
        return (metadata.pages || 1) > 1;
    } catch {
        return false;
    }
};

/**
 * Process image: resize variant, convert to WebP, enforce size limit with fallback
 */
const processVariant = async (buffer, options) => {
    const { width, height, quality, suffix, isAnimated: animated } = options;

    let pipeline = sharp(buffer, { animated });

    pipeline = pipeline
        .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .withMetadata(); // explicit EXIF handling — stripped below

    // Strip EXIF metadata for privacy
    // (sharp strips by default when outputting WebP, but be explicit)
    if (suffix === '') {
        // Full size: keep minimal metadata (orientation only), strip GPS/camera
        pipeline = pipeline.withMetadata({ exif: [] });
    } else {
        // Thumbnails: strip all metadata
        pipeline = pipeline.withMetadata({ exif: [] });
    }

    // Generate with initial quality
    let outputQuality = quality;
    let outputBuffer;

    const tryFormat = async (q) => {
        return await pipeline
            .clone()
            .webp({ quality: q, effort: 4 })
            .toBuffer();
    };

    outputBuffer = await tryFormat(outputQuality);

    // If output exceeds max size, reduce quality iteratively
    while (outputBuffer.length > MAX_OUTPUT_SIZE && outputQuality > MIN_QUALITY) {
        outputQuality -= 10;
        outputBuffer = await tryFormat(outputQuality);
    }

    return {
        buffer: outputBuffer,
        size: outputBuffer.length,
        quality: outputQuality,
        suffix,
    };
};

/**
 * Check if an AVIF variant should be generated (skip if not worth it)
 */
const processAvifVariant = async (buffer, options) => {
    const { width, height, quality, isAnimated: animated } = options;

    const avifBuffer = await sharp(buffer, { animated })
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .withMetadata({ exif: [] })
        .avif({ quality: Math.min(quality - 10, 60), effort: 4 })
        .toBuffer();

    // Only keep AVIF if it's meaningfully smaller than WebP
    return avifBuffer;
};

/**
 * Main entry: process an image buffer through the full pipeline.
 * Returns metadata with all variant URLs.
 *
 * @param {Buffer} buffer - Raw image buffer from multer
 * @param {object} [options]
 * @param {string} [options.oldImageUrl] - Previous image URL to clean up
 * @returns {Promise<object>}
 */
const processImage = async (buffer, options = {}) => {
    const { oldImageUrl } = options;

    // 1. Deep validate
    const fileType = await validateImage(buffer);
    if (!fileType) {
        const err = new Error('Invalid image content');
        err.code = 'INVALID_IMAGE';
        throw err;
    }

    // 2. Detect animation
    const animated = await isAnimated(buffer);

    // 3. Hash for dedup
    const hash = hashBuffer(buffer);
    const dateDir = getDateDir();

    // 4. Check Redis for existing hash (global dedup)
    try {
        const client = getRedisClient();
        const existing = await client.get(`${REDIS_HASH_PREFIX}${hash}`);
        if (existing) {
            const cached = JSON.parse(existing);
            // If we also have an old image to clean up, do it
            if (oldImageUrl) {
                await cleanupImage(oldImageUrl);
            }
            return cached;
        }
    } catch {
        // Redis unavailable — continue without dedup
    }

    // 5. Generate unique ID and date-based path
    const uid = uuidv4();
    const baseFilename = `${hash}-${uid}`;
    const imagesDir = `images/${dateDir}`;

    const results = { hash, variants: {} };

    // 6. Process each variant
    for (const [name, opts] of Object.entries(VARIANTS)) {
        const processed = await processVariant(buffer, {
            ...opts,
            isAnimated: animated,
        });

        const filename = `${baseFilename}${processed.suffix}.webp`;
        const relativePath = `${imagesDir}/${filename}`;
        const url = await storage.save(relativePath, processed.buffer);

        results.variants[name] = {
            url,
            size: processed.size,
            width: opts.width,
            quality: processed.quality,
        };
    }

    // 7. Generate AVIF variant (skip if animated)
    if (!animated) {
        try {
            const avifOpts = VARIANTS.full;
            const avifBuffer = await processAvifVariant(buffer, avifOpts);
            const webpSize = results.variants.full.size;

            // Only save AVIF if it's at least 15% smaller than WebP
            if (avifBuffer.length < webpSize * 0.85) {
                const avifFilename = `${baseFilename}.avif`;
                const avifRelativePath = `${imagesDir}/${avifFilename}`;
                const avifUrl = await storage.save(avifRelativePath, avifBuffer);
                results.variants.avif = {
                    url: avifUrl,
                    size: avifBuffer.length,
                };

                // Also try thumb AVIF
                const thumbAvifBuffer = await sharp(buffer)
                    .resize(VARIANTS.thumb.width, VARIANTS.thumb.height, { fit: 'inside', withoutEnlargement: true })
                    .withMetadata({ exif: [] })
                    .avif({ quality: 50, effort: 4 })
                    .toBuffer();

                if (thumbAvifBuffer.length < (results.variants.thumb?.size || Infinity) * 0.85) {
                    const thumbAvifFilename = `${baseFilename}_thumb.avif`;
                    const thumbAvifRelativePath = `${imagesDir}/${thumbAvifFilename}`;
                    const thumbAvifUrl = await storage.save(thumbAvifRelativePath, thumbAvifBuffer);
                    results.variants.thumbAvif = {
                        url: thumbAvifUrl,
                        size: thumbAvifBuffer.length,
                    };
                }
            }
        } catch {
            // AVIF encoding is slow and may fail on some systems — non-critical
        }
    }

    // 8. Store hash mapping in Redis (no expiry — file lives until explicitly deleted)
    try {
        const client = getRedisClient();
        await client.set(`${REDIS_HASH_PREFIX}${hash}`, JSON.stringify(results));
    } catch {
        // non-critical
    }

    // 9. Clean up old image if provided
    if (oldImageUrl) {
        await cleanupImage(oldImageUrl);
    }

    return results;
};

/**
 * Generate a public-facing URL for the primary variant (full WebP).
 * When requesting from frontend, they can use this directly.
 */
const getPrimaryUrl = (imageResults) => {
    if (!imageResults || !imageResults.variants) return null;
    const full = imageResults.variants.full;
    return full ? full.url : null;
};

const getThumbnailUrl = (imageResults) => {
    if (!imageResults || !imageResults.variants) return null;
    const thumb = imageResults.variants.thumb;
    return thumb ? thumb.url : null;
};

module.exports = {
    processImage,
    validateImage,
    getPrimaryUrl,
    getThumbnailUrl,
    VARIANTS,
};
