const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { logger } = require('./utils/logger');
const corsOptions = require('./config/corsoptions');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const qrAuthRoutes = require('./routes/qrAuth.routes');
const user = require('./routes/userRoutes');
const refreshRoutes = require('./routes/refreshRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ------------------------------------------------------------------
// GLOBAL MIDDLEWARE
// ------------------------------------------------------------------
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(compression());
app.use(mongoSanitize());
app.use(hpp());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use('/auth', limiter);
app.use(cors(corsOptions));
app.use(cookieParser());

// Body Parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.text({ type: ['text/plain', 'text/srt'], limit: '5mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------
app.use('/auth', authRoutes);
app.use('/auth/qr', qrAuthRoutes);
app.use('/user', user);
app.use('/refresh', refreshRoutes);
app.use('/admin', adminRoutes);

// ------------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------------
app.get('/', (req, res) => {
    res.json({ message: 'ahla bik win tnjm t3awn lfou9ara2 :)' });
});

// ------------------------------------------------------------------
// 404 Handler
// ------------------------------------------------------------------
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ------------------------------------------------------------------
// CENTRALIZED ERROR HANDLER
// ------------------------------------------------------------------
app.use(errorHandler);

module.exports = { app };
