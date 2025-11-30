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

const connectToTikTok = (username, socket) => {
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

    console.log(`[${socketId}] Attempting to connect to ${username}`);
    socket.emit('status', { status: 'connecting', message: `Connecting to ${username}...` });

    // Use Session ID if available (fix for cloud deployments)
    const options = {
        enableExtendedGiftInfo: true
    };

    if (process.env.TIKTOK_SESSION_ID) {
        options.sessionId = process.env.TIKTOK_SESSION_ID;
        console.log(`[${socketId}] Using Session ID for connection`);
    }

    const tiktokConnection = new WebcastPushConnection(username, options);
    clientState.tiktokConnection = tiktokConnection;

    tiktokConnection.connect()
        .then(state => {
            console.log(`[${socketId}] Connected to ${username} (Room ID: ${state.roomId})`);
            if (clientConnections.has(socketId)) {
                const currentState = clientConnections.get(socketId);
                currentState.isConnecting = false;
                socket.emit('status', { status: 'connected', message: `Connected to live stream!` });
                if (state.roomInfo) {
                    console.log(`[${socketId}] Stream URL Data found`);
                    // Debug log to inspect raw stream data
                    console.log(`[${socketId}] RAW STREAM DATA:`, JSON.stringify(state.roomInfo.stream_url, null, 2));
                    socket.emit('roomInfo', state.roomInfo);
                }
            }
        })
        .catch(err => {
            console.error(`[${socketId}] Failed to connect to ${username}`, err);
            if (clientConnections.has(socketId)) {
                const currentState = clientConnections.get(socketId);
                currentState.isConnecting = false;
                socket.emit('status', { status: 'offline', message: `User offline or not found. Retrying in 10s...` });

                // Retry logic
                if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                currentState.retryInterval = setInterval(() => {
                    if (clientConnections.has(socketId)) {
                        console.log(`[${socketId}] Retrying connection to ${username}...`);
                        connectToTikTok(username, socket);
                    } else {
                        clearInterval(currentState.retryInterval);
                    }
                }, 10000);
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
        socket.emit('status', { status: 'offline', message: 'Stream ended. Waiting for next stream...' });

        if (clientConnections.has(socketId)) {
            const currentState = clientConnections.get(socketId);
            if (currentState.retryInterval) clearInterval(currentState.retryInterval);
            currentState.retryInterval = setInterval(() => {
                if (clientConnections.has(socketId)) {
                    connectToTikTok(username, socket);
                }
            }, 10000);
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

    socket.on('join', (username) => {
        console.log(`[${socket.id}] Client requested to join: ${username}`);
        connectToTikTok(username, socket);
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
