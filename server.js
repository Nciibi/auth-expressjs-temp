require('dotenv').config();
const { app } = require('./app');
const { createServer } = require('http');
const connectDB = require('./config/dboptions');
const { initSocket } = require('./sockets/qr.socket');

// Connect to Database
connectDB();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`, process.env.NODE_ENV);
    console.log(`Database: ${process.env.MONGO_URI}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);

});
