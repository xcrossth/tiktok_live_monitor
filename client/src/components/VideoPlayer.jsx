import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Play, AlertCircle, Settings } from 'lucide-react';
import flvjs from 'flv.js';

const VideoPlayer = ({ username, roomInfo }) => {
    const [embedUrl, setEmbedUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [error, setError] = useState(null);
    const [debugMsg, setDebugMsg] = useState("");

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

    // Parse Room Info to get Qualities
    useEffect(() => {
        if (roomInfo && roomInfo.stream_url && roomInfo.stream_url.flv_pull_url) {
            const pullData = roomInfo.stream_url.flv_pull_url;
            let newQualities = {};

            if (typeof pullData === 'object') {
                console.log("Available Stream Qualities:", Object.keys(pullData)); // Debug log

                // Map internal names to readable ones
                const qualityMap = {
                    'uhd': 'Original (UHD)',
                    'origin': 'Original',
                    'FULL_HD1': '1080p',
                    'HD1': '720p',
                    'SD1': '480p',
                    'SD2': '360p',
                    'SD3': '240p'
                };

                // First pass: Add mapped qualities in order of priority
                Object.entries(qualityMap).forEach(([key, label]) => {
                    if (pullData[key]) {
                        newQualities[label] = pullData[key];
                    }
                });

                // Second pass: Add any remaining keys that weren't mapped
                Object.keys(pullData).forEach(key => {
                    const isMapped = Object.keys(qualityMap).includes(key);
                    if (!isMapped) {
                        newQualities[key] = pullData[key];
                    }
                });
            } else if (typeof pullData === 'string') {
                newQualities['Auto'] = pullData;
            }

            setQualities(newQualities);

            // Default to highest quality
            const qualityKeys = Object.keys(newQualities);
            if (qualityKeys.length > 0 && !currentQuality) {
                setCurrentQuality(qualityKeys[0]); // First one is usually highest priority in our extraction
            }
        }
    }, [roomInfo]);

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
            console.log(`Attempting to play ${currentQuality} stream:`, streamUrl);
            setDebugMsg(`Loading ${currentQuality} stream...`);

            if (flvjs.isSupported()) {
                const flvPlayer = flvjs.createPlayer({
                    type: 'flv',
                    url: streamUrl,
                    isLive: true,
                    cors: true,
                });

                flvPlayer.attachMediaElement(videoRef.current);
                flvPlayer.load();

                const playPromise = flvPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        setShowPlayButton(false);
                        setDebugMsg(`Playing ${currentQuality} stream!`);
                    }).catch(err => {
                        console.error("Play error:", err);
                        if (err.name === 'NotAllowedError' || err.message.includes('play() request was interrupted')) {
                            setIsPlaying(true);
                            setShowPlayButton(true);
                            setDebugMsg("Autoplay blocked. Click to play.");
                        } else {
                            setError("Autoplay blocked or CORS error.");
                            setDebugMsg(`Error: ${err.message}`);
                        }
                    });
                }

                flvPlayer.on(flvjs.Events.ERROR, (err) => {
                    console.error("FLV Error:", err);
                    setError("Stream error (CORS/Network).");
                    setDebugMsg(`FLV Error: ${err}`);
                    if (flvPlayerRef.current) {
                        flvPlayerRef.current.destroy();
                        flvPlayerRef.current = null;
                    }
                    setIsPlaying(false);
                });

                flvPlayerRef.current = flvPlayer;
            } else {
                setError("FLV not supported.");
                setDebugMsg("Browser does not support FLV.");
            }
        } else if (!roomInfo) {
            setDebugMsg("Waiting for stream info...");
        }
    }, [currentQuality, qualities, roomInfo]);

    const handleManualPlay = () => {
        if (flvPlayerRef.current) {
            flvPlayerRef.current.play()
                .then(() => {
                    setShowPlayButton(false);
                    setDebugMsg("Resumed playback.");
                })
                .catch(err => {
                    console.error("Manual play error:", err);
                    setDebugMsg(`Manual play failed: ${err.message}`);
                });
        }
    };

    const handleOpenPopup = () => {
        window.open(`https://www.tiktok.com/@${username}/live`, 'tiktok_live', 'width=400,height=800,menubar=no,toolbar=no');
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
                className={`w-full h-full object-contain ${isPlaying ? 'block' : 'hidden'}`}
                controls
                muted
            />

            {/* Quality Selector Overlay */}
            {isPlaying && Object.keys(qualities).length > 1 && (
                <div className="absolute top-4 right-4 z-30">
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

            {/* Manual Play Overlay */}
            {showPlayButton && isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                    <button
                        onClick={handleManualPlay}
                        className="bg-pink-600 hover:bg-pink-500 text-white rounded-full p-6 shadow-2xl transform transition-transform hover:scale-110"
                    >
                        <Play size={48} fill="currentColor" />
                    </button>
                </div>
            )}

            {/* Fallback Iframe */}
            {!isPlaying && (
                <div className="w-full h-full relative">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full border-0"
                        allowFullScreen
                        title="TikTok Live"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin"
                    />

                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                        <div className="pointer-events-auto bg-gray-900/90 p-6 rounded-xl border border-gray-700 shadow-2xl max-w-sm">
                            <AlertCircle className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">Video Embed Restricted</h3>
                            <p className="text-sm text-gray-400 mb-2">
                                TikTok often blocks external video players.
                            </p>
                            {debugMsg && (
                                <div className="mb-4 p-2 bg-black/50 rounded text-xs font-mono text-yellow-400 break-all">
                                    {debugMsg}
                                </div>
                            )}

                            <button
                                onClick={handleOpenPopup}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-blue-600 hover:from-pink-500 hover:to-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                            >
                                <ExternalLink size={18} />
                                Open in Popup Window
                            </button>
                        </div>
                    </div>
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
