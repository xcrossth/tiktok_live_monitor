const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

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
        retryInterval: null,
        roomInfo: null,
        ffmpegProcess: null
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
                    currentState.roomInfo = state.roomInfo; // Store roomInfo
                    socket.emit('roomInfo', state.roomInfo);
                }
            }
        })
        .catch(err => {
            console.error(`[${socketId}] Failed to connect to ${username}`, err);
            if (clientConnections.has(socketId)) {
                const currentState = clientConnections.get(socketId);
                currentState.isConnecting = false;

                const isLiveEnded = (err.toString().includes('LIVE has ended')) ||
                    (err.exception && err.exception.toString().includes('LIVE has ended')) ||
                    (err.message && err.message.includes('LIVE has ended'));

                if (isLiveEnded) {
                    console.log(`[${socketId}] Stream ended for ${username} (detected via error)`);
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
                } else if (enableAutoReconnect) {
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
        if (clientState.ffmpegProcess) {
            clientState.ffmpegProcess.kill('SIGINT');
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

    socket.on('startRecording', () => {
        const clientState = clientConnections.get(socket.id);
        if (!clientState || !clientState.tiktokConnection) return;

        // Check if already recording
        if (clientState.ffmpegProcess) {
            socket.emit('recordingStatus', { isRecording: true, message: 'Already recording' });
            return;
        }

        // We need a stream URL. 
        // Ideally, we should have captured it from the 'roomInfo' or connection state.
        // For now, we'll try to get it from the state if available, or ask client to send it?
        // Better: The client received roomInfo, but server also has access to it via state.roomInfo in the connect promise.
        // Let's store roomInfo in clientState when connected.

        if (!clientState.roomInfo || !clientState.roomInfo.stream_url) {
            socket.emit('recordingStatus', { isRecording: false, error: 'No stream URL found. Wait for connection.' });
            return;
        }

        const streamUrl = clientState.roomInfo.stream_url.rtmp_pull_url ||
            Object.values(clientState.roomInfo.stream_url.flv_pull_url)[0];

        if (!streamUrl) {
            socket.emit('recordingStatus', { isRecording: false, error: 'No valid stream URL found.' });
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recordings/${clientState.username}-${timestamp}.mp4`;

        // Ensure recordings dir exists
        const fs = require('fs');
        if (!fs.existsSync('recordings')) {
            fs.mkdirSync('recordings');
        }

        console.log(`[${socket.id}] Starting recording for ${clientState.username} to ${filename}`);
        socket.emit('recordingStatus', { isRecording: true, message: 'Recording started...' });

        const ffmpegProcess = ffmpeg(streamUrl)
            .setFfmpegPath(ffmpegPath)
            .inputOptions(['-re']) // Read input at native frame rate
            .outputOptions(['-c copy', '-bsf:a aac_adtstoasc']) // Copy stream, fix audio bitstream
            .output(filename)
            .on('start', (commandLine) => {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('error', (err) => {
                console.error('Ffmpeg error:', err);
                socket.emit('recordingStatus', { isRecording: false, error: 'Recording failed: ' + err.message });
                clientState.ffmpegProcess = null;
            })
            .on('end', () => {
                console.log('Ffmpeg process ended');
                socket.emit('recordingStatus', { isRecording: false, message: 'Recording saved.' });
                clientState.ffmpegProcess = null;
            });

        ffmpegProcess.run();
        clientState.ffmpegProcess = ffmpegProcess;
    });

    socket.on('stopRecording', () => {
        const clientState = clientConnections.get(socket.id);
        if (clientState && clientState.ffmpegProcess) {
            console.log(`[${socket.id}] Stopping recording for ${clientState.username}`);

            // Send 'q' to stdin to quit gracefully and write MP4 trailer
            if (clientState.ffmpegProcess.ffmpegProc && clientState.ffmpegProcess.ffmpegProc.stdin) {
                clientState.ffmpegProcess.ffmpegProc.stdin.write('q');
            } else {
                // Fallback if stdin not available
                clientState.ffmpegProcess.kill('SIGINT');
            }

            // Force kill if not finished in 5 seconds
            /*
            setTimeout(() => {
                if (clientState.ffmpegProcess) {
                    console.log('Force killing ffmpeg...');
                    clientState.ffmpegProcess.kill('SIGKILL');
                    clientState.ffmpegProcess = null;
                }
            }, 5000);
            */
            // Note: The 'end' event handler will clear clientState.ffmpegProcess
        }
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
