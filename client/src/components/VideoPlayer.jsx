import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Play, AlertCircle, Settings, Circle, Square } from 'lucide-react';
import flvjs from 'flv.js';
import io from 'socket.io-client'; // Import socket to emit events

// We need access to the socket instance. 
// Since it's defined in App.jsx and not passed down, we might need to export it or pass it as prop.
// For now, assuming we can import the same socket instance or it's passed as prop.
// Actually, App.jsx defines `const socket = ...` outside component. 
// Best practice: Pass socket as prop to VideoPlayer.

const VideoPlayer = ({ username, roomInfo, socket, volume, onVolumeChange }) => { // Accept socket and volume as prop
    const [embedUrl, setEmbedUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [error, setError] = useState(null);
    const [debugMsg, setDebugMsg] = useState("");

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingMsg, setRecordingMsg] = useState("");

    // Quality Switching State
    const [qualities, setQualities] = useState({});
    const [currentQuality, setCurrentQuality] = useState(null);
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);

    useEffect(() => {
        if (username) {
            setEmbedUrl(`https://www.tiktok.com/@${username}/live`);
        }
    }, [username]);

    // Listen for recording status
    useEffect(() => {
        if (!socket) return;

        const handleRecordingStatus = (data) => {
            setIsRecording(data.isRecording);
            if (data.message) setRecordingMsg(data.message);
            if (data.error) setRecordingMsg(data.error);
        };

        socket.on('recordingStatus', handleRecordingStatus);

        return () => {
            socket.off('recordingStatus', handleRecordingStatus);
        };
    }, [socket]);

    // Auto-hide recording message
    useEffect(() => {
        if (recordingMsg) {
            const timer = setTimeout(() => {
                setRecordingMsg("");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [recordingMsg]);

    const toggleRecording = () => {
        if (!socket) return;
        if (isRecording) {
            socket.emit('stopRecording');
        } else {
            socket.emit('startRecording');
        }
    };

    // Parse Room Info to get Qualities
    useEffect(() => {
        if (roomInfo && roomInfo.stream_url) {
            let newQualities = {};

            // Helper to add quality
            const addQuality = (key, url) => {
                if (!url) return;

                let label = null;
                const qualityMap = {
                    'uhd_60': '1080p 60fps',
                    'hd_60': '720p 60fps',
                    'uhd': 'Original (UHD)',
                    'origin': 'Original',
                    'FULL_HD1': '1080p',
                    'HD1': '720p',
                    'SD1': '480p',
                    'SD2': '360p',
                    'SD3': '240p',
                    'ld': 'Low Definition'
                };
                label = qualityMap[key] || key;

                if (newQualities[label] && newQualities[label] !== url) {
                    newQualities[`${label} (${key})`] = url;
                } else {
                    newQualities[label] = url;
                }
            };

            // 1. Check rtmp_pull_url (Force as Original if valid) - PRIORITY
            if (roomInfo.stream_url.rtmp_pull_url && roomInfo.stream_url.rtmp_pull_url.startsWith('http')) {
                addQuality('origin', roomInfo.stream_url.rtmp_pull_url);
            }

            // 2. Check flv_pull_url (Standard)
            const pullData = roomInfo.stream_url.flv_pull_url;
            if (typeof pullData === 'object') {
                Object.entries(pullData).forEach(([key, url]) => addQuality(key, url));
            } else if (typeof pullData === 'string') {
                newQualities['Auto'] = pullData;
            }

            setQualities(newQualities);

            // Default to Original if available, otherwise highest quality
            const qualityKeys = Object.keys(newQualities);
            if (qualityKeys.length > 0 && !currentQuality) {
                if (newQualities['Original']) {
                    setCurrentQuality('Original');
                } else if (newQualities['Original (UHD)']) {
                    setCurrentQuality('Original (UHD)');
                } else {
                    setCurrentQuality(qualityKeys[0]);
                }
            }
        }
    }, [roomInfo]);

    // Sync volume from prop
    useEffect(() => {
        if (videoRef.current && typeof volume === 'number' && isFinite(volume)) {
            // Apply only if impactful difference to avoid loops
            if (Math.abs(videoRef.current.volume - volume) > 0.001) {
                console.log("[VideoPlayer] Syncing down from Prop:", volume);
                videoRef.current.volume = Math.max(0, Math.min(1, volume));
            }
        }
    }, [volume]);

    // Initialize Player when Quality or RoomInfo changes
    useEffect(() => {
        // Cleanup previous player
        if (flvPlayerRef.current) {
            flvPlayerRef.current.destroy();
            flvPlayerRef.current = null;
        }
        setIsPlaying(false);
        setError(null);
        setDebugMsg("");

        if (currentQuality && qualities[currentQuality]) {
            const streamUrl = qualities[currentQuality];

            if (flvjs.isSupported()) {
                const flvPlayer = flvjs.createPlayer({
                    type: 'flv',
                    url: streamUrl,
                    isLive: true,
                    cors: true,
                });

                flvPlayer.attachMediaElement(videoRef.current);
                flvPlayer.load();

                // Force volume application immediately on load
                if (typeof volume === 'number' && isFinite(volume)) {
                    videoRef.current.volume = Math.max(0, Math.min(1, volume));
                }

                const playPromise = flvPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        setShowPlayButton(false);
                        // Force volume AGAIN after play starts
                        if (videoRef.current && typeof volume === 'number' && isFinite(volume)) {
                            videoRef.current.volume = Math.max(0, Math.min(1, volume));
                        }
                    }).catch(err => {
                        if (err.name === 'NotAllowedError' || err.message.includes('play() request was interrupted')) {
                            setIsPlaying(true);
                            setShowPlayButton(true);
                        } else {
                            setError("Autoplay blocked or CORS error.");
                        }
                    });
                }

                flvPlayer.on(flvjs.Events.ERROR, (err) => {
                    setError("Stream error (CORS/Network).");
                    if (flvPlayerRef.current) {
                        flvPlayerRef.current.destroy();
                        flvPlayerRef.current = null;
                    }
                    setIsPlaying(false);
                });

                flvPlayerRef.current = flvPlayer;
            } else {
                setError("FLV not supported.");
            }
        }
    }, [currentQuality, qualities, roomInfo]);

    const handleManualPlay = () => {
        if (flvPlayerRef.current) {
            flvPlayerRef.current.play()
                .then(() => {
                    setShowPlayButton(false);
                })
                .catch(err => {
                    console.error("Manual play error:", err);
                });
        }
    };

    const changeQuality = (q) => {
        setCurrentQuality(q);
        setShowQualityMenu(false);
    };

    return (
        <div className="w-full h-full bg-black relative flex flex-col overflow-hidden group">
            {/* Native Player */}
            <video
                ref={videoRef}
                className="w-full h-full object-contain block"
                controls
                onCanPlay={() => {
                    // Force volume on canplay event (most reliable)
                    if (videoRef.current && typeof volume === 'number' && isFinite(volume)) {
                        videoRef.current.volume = Math.max(0, Math.min(1, volume));
                    }
                }}
                onVolumeChange={(e) => {
                    if (onVolumeChange) {
                        // Only notify if difference is significant to avoid loops
                        if (Math.abs(e.target.volume - volume) > 0.001) {
                            console.log("[VideoPlayer] Syncing up to App:", e.target.volume);
                            onVolumeChange(e.target.volume);
                        }
                    }
                }}
            />

            {/* Controls Overlay (Top Right) */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                {/* Record Button */}
                {isPlaying && (
                    <button
                        onClick={toggleRecording}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border backdrop-blur-sm transition-all ${isRecording
                            ? 'bg-red-600/80 border-red-500 text-white animate-pulse'
                            : 'bg-black/60 hover:bg-black/80 border-gray-600 text-white'
                            }`}
                        title={isRecording ? "Stop Recording" : "Start Recording"}
                    >
                        {isRecording ? <Square size={14} fill="currentColor" /> : <Circle size={14} fill="currentColor" />}
                        {isRecording ? "REC" : "Record"}
                    </button>
                )}

                {/* Quality Selector */}
                {isPlaying && Object.keys(qualities).length > 1 && (
                    <div className="relative">
                        <button
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                            className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-gray-600 backdrop-blur-sm transition-all"
                        >
                            <Settings size={14} />
                            {currentQuality}
                        </button>

                        {showQualityMenu && (
                            <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[100px]">
                                {Object.keys(qualities).map(q => (
                                    <button
                                        key={q}
                                        onClick={() => changeQuality(q)}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors ${currentQuality === q ? 'text-pink-500 font-bold' : 'text-gray-300'}`}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recording Message Toast */}
            {recordingMsg && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full backdrop-blur-md z-40 transition-opacity">
                    {recordingMsg}
                </div>
            )}

            {/* Manual Play Overlay */}
            {showPlayButton && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                    <button
                        onClick={handleManualPlay}
                        className="bg-pink-600 hover:bg-pink-500 text-white rounded-full p-6 shadow-2xl transform transition-transform hover:scale-110"
                    >
                        <Play size={48} fill="currentColor" />
                    </button>
                </div>
            )}

            {/* Status Indicator */}
            {isPlaying && !showPlayButton && (
                <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 animate-pulse pointer-events-none z-10">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    LIVE (Native)
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
