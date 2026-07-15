const { getRedisClient } = require('../config/redis');

const PREFIX = 'reg:';
const TTL_SECONDS = 600;

const registrationStore = {
    async set(email, data) {
        const client = getRedisClient();
        await client.setEx(`${PREFIX}${email}`, TTL_SECONDS, JSON.stringify(data));
    },

    async get(email) {
        const client = getRedisClient();
        const raw = await client.get(`${PREFIX}${email}`);
        if (!raw) return null;
        return JSON.parse(raw);
    },

    async delete(email) {
        const client = getRedisClient();
        await client.del(`${PREFIX}${email}`);
    },

    async has(email) {
        const client = getRedisClient();
        const exists = await client.exists(`${PREFIX}${email}`);
        return exists === 1;
    }
};

module.exports = registrationStore;
