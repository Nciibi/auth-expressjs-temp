const fs = require('fs/promises');
const path = require('path');

const BASE_DIR = path.resolve(process.cwd(), 'uploads');

const normalizePath = (p) => p.replace(/\\/g, '/');

const localStorage = {
    async save(relativePath, buffer) {
        const fullPath = path.join(BASE_DIR, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buffer);
        return normalizePath(`/${relativePath}`);
    },

    async delete(url) {
        const relative = url.replace(/^\//, '');
        const fullPath = path.join(BASE_DIR, relative);
        try {
            await fs.unlink(fullPath);
        } catch {
            // ignore if file doesn't exist
        }
    },

    async exists(relativePath) {
        const fullPath = path.join(BASE_DIR, relativePath);
        try {
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    },

    async read(relativePath) {
        const fullPath = path.join(BASE_DIR, relativePath);
        return await fs.readFile(fullPath);
    },

    getBaseDir() {
        return BASE_DIR;
    }
};

module.exports = localStorage;
