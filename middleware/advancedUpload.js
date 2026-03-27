const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const { hashBuffer } = require('../utils/imageHash');
const { validateImageBuffer } = require('../utils/imageValidation');

// ======================
// CONFIG
// ======================
// Store images inside a local `uploads` directory relative to project root
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/images');
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// ======================
// MEMORY STORAGE
// ======================
const upload = multer({
    
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif'
        ];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('INVALID_TYPE'), false);
        }
        cb(null, true);
        console.log('Image processed successfully');
    }
});

// ======================
// MAIN PROCESSOR
// ======================
const processImage = async (req, res, next) => {
    try {
        console.log(req.file);
        if (!req.file) return next(); // No file uploaded, skip

        // 1️⃣ Validate real image content
        const isValid = await validateImageBuffer(req.file.buffer);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid image content' });
        }

        // 2️⃣ Hash image
        const hash = hashBuffer(req.file.buffer);

        // 3️⃣ Date folders (organize uploads by date)
        const now = new Date();
        const dir = path.join(
            BASE_UPLOAD_DIR,
            `${now.getFullYear()}`,
            `${String(now.getMonth() + 1).padStart(2, '0')}`,
            `${String(now.getDate()).padStart(2, '0')}`
        );

        // Create folders if they don't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 4️⃣ Final filename
        const filename = `${hash}-${uuidv4()}.webp`;
        const finalPath = path.join(dir, filename);
        const publicUrlPath = `/uploads/images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${filename}`;

        // 5️⃣ Check duplicate (Hash ensures uniqueness)
        const existingFileName = fs.readdirSync(dir).find(f => f.startsWith(hash));
        if (existingFileName) {
            // Return existing file path instead of duplicating it
            req.uploadedFile = {
                filename: existingFileName,
                path: path.join(dir, existingFileName),
                url: `/uploads/images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${existingFileName}`
            };
            return next();
        }

        // 6️⃣ Optimize + Save as webp
        await sharp(req.file.buffer)
            .resize(1600, null, { withoutEnlargement: true }) // Max width 1600px
            .webp({ quality: 80 })
            .toFile(finalPath);

        // 7️⃣ Attach metadata to req object
        req.uploadedFile = {
            filename,
            path: finalPath,
            url: publicUrlPath,
            size: fs.statSync(finalPath).size,
            hash
        };

        next();
    } catch (err) {
        console.error('Image processing failed:', err);
        res.status(500).json({ success: false, message: 'Image processing failed' });
    }
};

// ======================
// ERROR HANDLER
// ======================
const uploadErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.log("upload error hundler")
        console.log(err)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large (5MB max)' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: `Unexpected field: ${err.field}. Please use 'evidance' for the donation image.` });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }

    if (err.message === 'INVALID_TYPE') {
        return res.status(400).json({ success: false, message: 'Only images are allowed' });
    }

    // Pass to Express default error handler if it's something else
    next(err);
};

module.exports = {
    upload,
    processImage,
    uploadErrorHandler
};
