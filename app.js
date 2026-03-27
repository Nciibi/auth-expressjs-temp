const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { logger } = require('./utils/logger');
const corsOptions = require('./config/corsoptions');
const { errorLoggerMiddleware } = require('./middleware/errorLoggerMiddleware');
const bcrypt = require('bcryptjs');
//=======================================
//routes
//=======================================
const authRoutes = require('./routes/authRoutes');
const qrAuthRoutes = require('./routes/qrAuth.routes');
const user = require('./routes/userRoutes');
const refreshRoutes = require('./routes/refreshRoutes');
// ------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------
const app = express();
// ------------------------------------------------------------------
// GLOBAL MIDDLEWARE 
// ------------------------------------------------------------------
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
// ------------------------------------------------------------------
// LOG EACH REQUEST
// ------------------------------------------------------------------
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} `);
    next();
});
app.use('/auth', limiter); // Apply to all auth routes
app.use(cors(corsOptions));
app.use(cookieParser());
app.use('/refresh',refreshRoutes)

// Body Parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.text({ type: ['text/plain', 'text/srt'], limit: '5mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------
// Mount the authentication template
app.use('/auth', authRoutes);

// Mount QR Auth routes
app.use('/auth/qr', qrAuthRoutes);


app.use('/user', user)   

app.use('/refresh', refreshRoutes)



// ------------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------------
app.get('/', (req, res) => {
    res.json({ message: 'ahla bik win tnjm t3awn lfou9ara2 :)' });
});

// ------------------------------------------------------------------
// ERROR LOGGER MIDDLEWARE (MUST BE BEFORE FINAL HANDLER)
// ------------------------------------------------------------------
app.use(errorLoggerMiddleware());

// ------------------------------------------------------------------
// FINAL ERROR HANDLER
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
        }),
    });
});

module.exports = { app };
