const path = require('path');
const fs = require('fs/promises');
const { getRedisClient } = require('../config/redis');

const REDIS_HASH_PREFIX = 'img_hash:';
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Delete a single image file by its URL path.
 * Also removes any variant files (thumbnail, avif) stored alongside it.
 */
const deleteImageByUrl = async (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return;

    const relative = imageUrl.replace(/^\//, '');
    const fullPath = path.join(BASE_UPLOAD_DIR, relative);

    try {
        await fs.unlink(fullPath);
    } catch {
        // file may not exist, ignore
    }

    // Try deleting sibling variants (thumbnail, avif)
    const dir = path.dirname(fullPath);
    const ext = path.extname(fullPath);
    const base = path.basename(fullPath, ext);

    const variants = [
        path.join(dir, `${base}_thumb${ext}`),
        path.join(dir, `${base}.avif`),
        path.join(dir, `${base}_thumb.avif`),
    ];

    for (const v of variants) {
        try { await fs.unlink(v); } catch { /* ignore */ }
    }
};

/**
 * Delete all images associated with a user's old photo and
 * remove their hash entries from Redis.
 * @param {string|null} imageUrl - The photo URL to delete
 */
const cleanupImage = async (imageUrl) => {
    if (!imageUrl) return;

    await deleteImageByUrl(imageUrl);

    // Try to clean up Redis hash index
    try {
        const client = getRedisClient();
        const filename = path.basename(imageUrl.replace(/^\//, ''));
        const hash = filename.split('-')[0]; // filenames are hash-uuid.ext
        if (hash && hash.length === 64) {
            await client.del(`${REDIS_HASH_PREFIX}${hash}`);
        }
    } catch {
        // Redis might not be connected, ignore
    }
};

/**
 * Check if an image URL is still referenced by any user in the system.
 * This helps with manual cleanup of orphaned files.
 * To be called from a scheduled job or admin endpoint.
 */
const isImageReferenced = async (imageUrl, models) => {
    if (!imageUrl) return false;
    for (const Model of models) {
        const count = await Model.countDocuments({ photo: imageUrl });
        if (count > 0) return true;
    }
    return false;
};

module.exports = {
    deleteImageByUrl,
    cleanupImage,
    isImageReferenced,
};
