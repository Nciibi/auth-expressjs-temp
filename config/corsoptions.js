const allowedOrigins = require('./allowedorigins');

const corsOptions = {
    origin: (origin, callback) => {
        // Allow listed origins, OR allow requests with no origin (like mobile apps or curl requests)
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    // Standard headers needed for Auth tokens and JSON
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, // Required for setting http-only cookies (refresh tokens)
    optionsSuccessStatus: 200
};

module.exports = corsOptions;
