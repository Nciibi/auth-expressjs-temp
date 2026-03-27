const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
             // Use same CORS as Express or customize list
            origin: process.env.FRONTEND_URL || '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // PC Browser joins a specific session room to listen for authentication updates
        socket.on('qr:join-session', (sessionId) => {
            if (sessionId) {
                socket.join(sessionId);
                console.log(`Socket ${socket.id} joined session room: ${sessionId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = { initSocket, getIo };
