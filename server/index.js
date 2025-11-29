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

let tiktokConnection = null;
let currentUsername = null;
let isConnecting = false;
let retryInterval = null;

const connectToTikTok = (username, socket) => {
    if (isConnecting) return;

    // Cleanup existing connection
    if (tiktokConnection) {
        tiktokConnection.disconnect();
        tiktokConnection = null;
    }

    // Clear any existing retry interval
    if (retryInterval) {
        clearInterval(retryInterval);
        retryInterval = null;
    }

    currentUsername = username;
    isConnecting = true;

    console.log(`Attempting to connect to ${username}`);
    socket.emit('status', { status: 'connecting', message: `Connecting to ${username}...` });

    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect()
        .then(state => {
            console.log(`Connected to ${username} (Room ID: ${state.roomId})`);
            isConnecting = false;
            socket.emit('status', { status: 'connected', message: `Connected to live stream!` });
            if (state.roomInfo) {
                console.log("Stream URL Data:", JSON.stringify(state.roomInfo.stream_url, null, 2));
                socket.emit('roomInfo', state.roomInfo);
            }
        })
        .catch(err => {
            console.error('Failed to connect', err);
            isConnecting = false;
            socket.emit('status', { status: 'offline', message: `User offline or not found. Retrying in 10s...` });

            // Retry logic
            retryInterval = setInterval(() => {
                if (!tiktokConnection || !tiktokConnection.connected) {
                    console.log(`Retrying connection to ${username}...`);
                    connectToTikTok(username, socket);
                }
            }, 10000);
        });

    // Event listeners
    tiktokConnection.on('chat', data => {
        socket.emit('chat', { type: 'chat', ...data });
    });

    tiktokConnection.on('gift', data => {
        socket.emit('gift', data);
    });

    tiktokConnection.on('like', data => {
        socket.emit('chat', { type: 'like', ...data });
    });

    tiktokConnection.on('social', data => {
        socket.emit('chat', { type: 'share', ...data });
    });

    tiktokConnection.on('member', data => {
        socket.emit('chat', { type: 'join', ...data });
    });

    tiktokConnection.on('roomUser', data => {
        socket.emit('roomUser', data);
    });

    tiktokConnection.on('streamEnd', () => {
        console.log('Stream ended');
        socket.emit('status', { status: 'offline', message: 'Stream ended. Waiting for next stream...' });
        // Start polling/retrying
        retryInterval = setInterval(() => {
            connectToTikTok(username, socket);
        }, 10000);
    });

    tiktokConnection.on('error', err => {
        console.error('Connection Error:', err);
        // Don't necessarily disconnect, just log. Library handles some reconnections.
    });
};

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join', (username) => {
        console.log(`Client requested to join: ${username}`);
        connectToTikTok(username, socket);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        if (tiktokConnection) {
            tiktokConnection.disconnect();
        }
        if (retryInterval) {
            clearInterval(retryInterval);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
