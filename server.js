require('dotenv').config();
const { app } = require('./app');
const { createServer } = require('http');
const connectDB = require('./config/dboptions');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./sockets/qr.socket');

const start = async () => {
    await connectDB();
    await connectRedis();

    const httpServer = createServer(app);

    initSocket(httpServer);

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`, process.env.NODE_ENV);
        console.log(`Database: ${process.env.MONGO_URI}`);
        console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    });
};

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
