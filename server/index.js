const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('TikTok Live Monitor Backend is Running!');
});

// Store connections per socket
const clientConnections = new Map();

const connectToTikTok = (username, socket, options = {}) => {
    const { enableAutoReconnect = false, retryInterval = 10000 } = options;
    const socketId = socket.id;

    // Get existing connection state or create new
    let clientState = clientConnections.get(socketId);

    // If already connecting to this user, ignore
    if (clientState && clientState.isConnecting && clientState.username === username) return;

    // Cleanup existing connection if switching users
    if (clientState) {
        cleanupConnection(socketId);
    }

    // Initialize new state
    clientState = {
        tiktokConnection: null,
        username: username,
        isConnecting: true,
        retryInterval: null
    };
    clientConnections.set(socketId, clientState);

    console.log(`[${socketId}] Attempting to connect to ${username} (AutoReconnect: ${enableAutoReconnect}, Interval: ${retryInterval}ms)`);
    socket.emit('status', { status: 'connecting', message: `Connecting to ${username}...` });

    const connectOptions = {
        enableExtendedGiftInfo: true,
        sessionId: process.env.TIKTOK_SESSION_ID || null,
        requestOptions: {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        }
    };

    const tiktokConnection = new WebcastPushConnection(username, connectOptions);
    clientState.tiktokConnection = tiktokConnection;

    tiktokConnection.connect()
        .then(state => {
            console.log(`[${socketId}] Connected to ${username} (Room ID: ${state.roomId})`);
            if (clientConnections.has(socketId)) {
                const currentState = clientConnections.get(socketId);
                currentState.isConnecting = false;
                socket.emit('status', { status: 'connected', message: `Connected to live stream!` });
                if (state.roomInfo) {
                    socket.emit('roomInfo', state.roomInfo);
                }
            }
        })
        .catch(err => {
            console.error(`[${socketId}] Failed to connect to ${username}`, err);
            if (clientConnections.has(socketId)) {
                const currentState = clientConnections.get(socketId);
                currentState.isConnecting = false;

                if (enableAutoReconnect) {
                    socket.emit('status', { status: 'offline', message: `Connection failed. Retrying in ${retryInterval / 1000}s...` });
                    // Retry logic
                    if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                    currentState.retryInterval = setInterval(() => {
                        if (clientConnections.has(socketId)) {
                            console.log(`[${socketId}] Retrying connection to ${username}...`);
                            connectToTikTok(username, socket, options);
                        } else {
                            clearInterval(currentState.retryInterval);
                        }
                    }, Math.max(2000, retryInterval));
                } else {
                    socket.emit('status', { status: 'error', message: `Connection failed: ${err.message || 'Unknown error'}` });
                }
            }
        });

    // Event listeners
    tiktokConnection.on('chat', data => socket.emit('chat', { type: 'chat', ...data }));
    tiktokConnection.on('gift', data => socket.emit('gift', data));
    tiktokConnection.on('like', data => socket.emit('chat', { type: 'like', ...data }));
    tiktokConnection.on('social', data => socket.emit('chat', { type: 'share', ...data }));
    tiktokConnection.on('member', data => socket.emit('chat', { type: 'join', ...data }));
    tiktokConnection.on('roomUser', data => socket.emit('roomUser', data));

    tiktokConnection.on('streamEnd', () => {
        console.log(`[${socketId}] Stream ended for ${username}`);

        if (clientConnections.has(socketId)) {
            const currentState = clientConnections.get(socketId);

            if (enableAutoReconnect) {
                socket.emit('status', { status: 'offline', message: 'Stream ended. Waiting for next stream...' });
                if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                currentState.retryInterval = setInterval(() => {
                    if (clientConnections.has(socketId)) {
                        connectToTikTok(username, socket, options);
                    }
                }, Math.max(2000, retryInterval));
            } else {
                socket.emit('status', { status: 'offline', message: 'Stream ended.' });
            }
        }
    });

    tiktokConnection.on('error', err => {
        console.error(`[${socketId}] Connection Error:`, err);
    });
};

const cleanupConnection = (socketId) => {
    const clientState = clientConnections.get(socketId);
    if (clientState) {
        console.log(`[${socketId}] Cleaning up connection for ${clientState.username}`);
        if (clientState.tiktokConnection) {
            clientState.tiktokConnection.disconnect();
        }
        if (clientState.retryInterval) {
            clearInterval(clientState.retryInterval);
        }
        clientConnections.delete(socketId);
    }
};

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join', (data) => {
        let username;
        let options = {};

        if (typeof data === 'string') {
            username = data;
        } else {
            username = data.username;
            options = data.options || {};
        }

        console.log(`[${socket.id}] Client requested to join: ${username}`);
        connectToTikTok(username, socket, options);
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        cleanupConnection(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
