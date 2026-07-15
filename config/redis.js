const redis = require('redis');

let client = null;

async function connectRedis() {
    if (client && client.isOpen) return client;

    client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    client.on('error', (err) => {
        console.error('Redis connection error:', err.message);
    });

    client.on('connect', () => {
        console.log('Connected to Redis');
    });

    await client.connect();
    return client;
}

function getRedisClient() {
    if (!client || !client.isOpen) {
        throw new Error('Redis not connected. Call connectRedis() first.');
    }
    return client;
}

module.exports = { connectRedis, getRedisClient };
