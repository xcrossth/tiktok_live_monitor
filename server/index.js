const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

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

                // Fetch available gifts to get full animation data
                tiktokConnection.getAvailableGifts().then(giftList => {
                    console.log(`[${socketId}] Fetched ${giftList.length} available gifts`);
                    currentState.giftMap = new Map();
                    giftList.forEach(g => {
                        currentState.giftMap.set(g.id, g);
                    });
                }).catch(err => {
                    console.error(`[${socketId}] Failed to fetch available gifts:`, err);
                });
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
                        const effectiveInterval = Math.max(2000, retryInterval);
                        socket.emit('status', {
                            status: 'offline',
                            message: 'Stream ended. Waiting for next stream...',
                            nextRetryTime: Date.now() + effectiveInterval
                        });
                        if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                        currentState.retryInterval = setInterval(() => {
                            if (clientConnections.has(socketId)) {
                                connectToTikTok(username, socket, options);
                            }
                        }, effectiveInterval);
                    } else {
                        socket.emit('status', { status: 'offline', message: 'Stream ended.' });
                    }
                } else if (enableAutoReconnect) {
                    const effectiveInterval = Math.max(2000, retryInterval);
                    socket.emit('status', {
                        status: 'offline',
                        message: `Connection failed. Retrying in ${Math.round(retryInterval / 1000)}s...`,
                        nextRetryTime: Date.now() + effectiveInterval
                    });
                    // Retry logic
                    if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                    currentState.retryInterval = setInterval(() => {
                        if (clientConnections.has(socketId)) {
                            console.log(`[${socketId}] Retrying connection to ${username}...`);
                            connectToTikTok(username, socket, options);
                        } else {
                            clearInterval(currentState.retryInterval);
                        }
                    }, effectiveInterval);
                } else {
                    socket.emit('status', { status: 'error', message: `Connection failed: ${err.message || 'Unknown error'}` });
                }
            }
        });

    // Event listeners
    tiktokConnection.on('chat', data => socket.emit('chat', { type: 'chat', ...data }));

    // Enhanced Gift Handler
    tiktokConnection.on('gift', data => {
        const clientState = clientConnections.get(socketId);
        if (clientState && clientState.giftMap && clientState.giftMap.has(data.giftId)) {
            const fullGift = clientState.giftMap.get(data.giftId);
            // Merge important missing fields from fullGift into data.extendedGiftInfo
            if (!data.extendedGiftInfo) data.extendedGiftInfo = {};

            // Map known fields from the git list to extendedGiftInfo or root
            // Note: The structure of getAvailableGifts items might differ slightly, but usually has 'image', 'icon', 'video_url' etc.
            // We'll attach the whole fullGift as 'staticInfo' just in case
            data.staticInfo = fullGift;
        }
        socket.emit('gift', data);
    });

    tiktokConnection.on('like', data => socket.emit('chat', { type: 'like', ...data }));
    tiktokConnection.on('social', data => socket.emit('chat', { type: 'share', ...data }));
    tiktokConnection.on('member', data => socket.emit('chat', { type: 'join', ...data }));
    tiktokConnection.on('roomUser', data => socket.emit('roomUser', data));

    tiktokConnection.on('streamEnd', () => {
        console.log(`[${socketId}] Stream ended for ${username}`);

        if (clientConnections.has(socketId)) {
            const currentState = clientConnections.get(socketId);

            if (enableAutoReconnect) {
                const effectiveInterval = Math.max(2000, retryInterval);
                socket.emit('status', {
                    status: 'offline',
                    message: 'Stream ended. Waiting for next stream...',
                    nextRetryTime: Date.now() + effectiveInterval
                });
                if (currentState.retryInterval) clearInterval(currentState.retryInterval);
                currentState.retryInterval = setInterval(() => {
                    if (clientConnections.has(socketId)) {
                        connectToTikTok(username, socket, options);
                    }
                }, effectiveInterval);
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

    // --- Animation Caching Logic ---
    const ANIMATION_CACHE_DIR = path.join(__dirname, 'public', 'animations');
    if (!fs.existsSync(ANIMATION_CACHE_DIR)) {
        fs.mkdirSync(ANIMATION_CACHE_DIR, { recursive: true });
    }

    app.get('/api/animation-proxy', async (req, res) => {
        const { url: animationUrl } = req.query;

        if (!animationUrl) {
            return res.status(400).send('Missing url parameter');
        }

        // Enable CORS for this endpoint
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

        try {
            const hash = crypto.createHash('md5').update(animationUrl).digest('hex');
            // We can't trust the URL extension alone. We check if we have ANY file with this hash.
            // But for simplicity, let's try to find an existing file matching the pattern.
            const files = fs.readdirSync(ANIMATION_CACHE_DIR);
            const cachedFile = files.find(f => f.startsWith(hash));

            if (cachedFile) {
                const filePath = path.join(ANIMATION_CACHE_DIR, cachedFile);
                const ext = path.extname(cachedFile).toLowerCase();

                // Set correct content type based on extension
                if (ext === '.svga') res.setHeader('Content-Type', 'application/octet-stream');
                else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
                else if (ext === '.mp4') res.setHeader('Content-Type', 'video/mp4');
                else if (ext === '.json') res.setHeader('Content-Type', 'application/json');
                else if (ext === '.png') res.setHeader('Content-Type', 'image/png');
                else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');

                return res.sendFile(filePath);
            }

            console.log(`[Cache Miss] Downloading: ${animationUrl}`);
            const response = await axios({
                method: 'get',
                url: animationUrl,
                responseType: 'stream'
            });

            // Determine extension from Content-Type
            const contentType = response.headers['content-type'];
            let ext = '.svga'; // Default
            if (contentType) {
                if (contentType.includes('webp')) ext = '.webp';
                else if (contentType.includes('mp4') || contentType.includes('video')) ext = '.mp4';
                else if (contentType.includes('json')) ext = '.json';
                else if (contentType.includes('png')) ext = '.png';
                else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
                else if (contentType.includes('octet-stream')) {
                    // Try to guess from URL if header is generic
                    const urlExt = path.extname(animationUrl).split('?')[0];
                    if (urlExt) ext = urlExt;
                }
            }

            const filename = `${hash}${ext}`;
            const filePath = path.join(ANIMATION_CACHE_DIR, filename);
            const writer = fs.createWriteStream(filePath);

            response.data.pipe(writer);

            writer.on('finish', () => {
                // Set header for the response we are about to send
                if (ext === '.svga') res.setHeader('Content-Type', 'application/octet-stream');
                else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
                else if (ext === '.mp4') res.setHeader('Content-Type', 'video/mp4');
                else if (ext === '.json') res.setHeader('Content-Type', 'application/json');
                else if (ext === '.png') res.setHeader('Content-Type', 'image/png');
                else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');

                res.sendFile(filePath);
            });

            writer.on('error', (err) => {
                console.error('File Write Error:', err);
                res.status(500).send('Failed to save animation');
            });

        } catch (error) {
            console.error('Proxy Error:', error.message);
            res.status(500).send('Failed to fetch animation');
        }
    });
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
        // CHANGE: Record to MKV first to prevent corruption on crash
        const mkvFilename = `recordings/${clientState.username}-${timestamp}.mkv`;
        const mp4Filename = `recordings/${clientState.username}-${timestamp}.mp4`;

        // Ensure recordings dir exists
        const fs = require('fs');
        if (!fs.existsSync('recordings')) {
            fs.mkdirSync('recordings');
        }

        console.log(`[${socket.id}] Starting recording for ${clientState.username} to ${mkvFilename}`);
        socket.emit('recordingStatus', { isRecording: true, message: 'Recording started (MKV)...' });

        const ffmpegProcess = ffmpeg(streamUrl)
            .setFfmpegPath(ffmpegPath)
            .inputOptions(['-re']) // Read input at native frame rate
            .outputOptions(['-c copy']) // Copy stream directly, MKV handles aac/h264 fine
            .output(mkvFilename)
            .on('start', (commandLine) => {
                console.log('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('error', (err) => {
                console.error('Ffmpeg error:', err);
                // Even on error, we try to recover the file if it exists
                if (fs.existsSync(mkvFilename)) {
                    console.log('Attempting to recover partial recording...');
                    remuxToMp4(mkvFilename, mp4Filename, socket);
                } else {
                    socket.emit('recordingStatus', { isRecording: false, error: 'Recording failed: ' + err.message });
                }
                clientState.ffmpegProcess = null;
            })
            .on('end', () => {
                console.log('Ffmpeg process ended. Starting remux to MP4...');
                socket.emit('recordingStatus', { isRecording: true, message: 'Processing... converting to MP4' });
                clientState.ffmpegProcess = null;

                remuxToMp4(mkvFilename, mp4Filename, socket);
            });

        ffmpegProcess.run();
        clientState.ffmpegProcess = ffmpegProcess;
    });

    // Helper function to remux MKV to MP4
    const remuxToMp4 = (inputPath, outputPath, socket) => {
        ffmpeg(inputPath)
            .setFfmpegPath(ffmpegPath)
            .outputOptions(['-c copy', '-bsf:a aac_adtstoasc'])
            .output(outputPath)
            .on('end', () => {
                console.log('Remux finished:', outputPath);
                socket.emit('recordingStatus', { isRecording: false, message: 'Recording saved: ' + path.basename(outputPath) });
                // Delete the temporary MKV file
                fs.unlink(inputPath, (err) => {
                    if (err) console.error('Error deleting temp MKV:', err);
                });
            })
            .on('error', (err) => {
                console.error('Remux error:', err);
                socket.emit('recordingStatus', { isRecording: false, error: 'Failed to process MP4. Raw MKV saved.' });
            })
            .run();
    };

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
