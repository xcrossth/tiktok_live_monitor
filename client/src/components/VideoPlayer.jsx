import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Play, AlertCircle } from 'lucide-react';
import flvjs from 'flv.js';

const VideoPlayer = ({ username, roomInfo }) => {
    const [embedUrl, setEmbedUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [error, setError] = useState(null);
    const [debugMsg, setDebugMsg] = useState("");
    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);

    useEffect(() => {
        if (username) {
            setEmbedUrl(`https://www.tiktok.com/@${username}/live`);
        }
    }, [username]);

    useEffect(() => {
        // Cleanup previous player
        if (flvPlayerRef.current) {
            flvPlayerRef.current.destroy();
            flvPlayerRef.current = null;
        }
        setIsPlaying(false);
        setError(null);
        setDebugMsg("");

        if (roomInfo && roomInfo.stream_url) {
            console.log("Attempting to play stream from roomInfo", roomInfo.stream_url);
            setDebugMsg("Found stream info...");

            let streamUrl = null;
            const streamData = roomInfo.stream_url;

            // Try to find a valid FLV URL
            if (streamData.flv_pull_url) {
                // Priority: FULL_HD1 > HD1 > SD1 > SD2
                streamUrl = streamData.flv_pull_url.FULL_HD1 ||
                    streamData.flv_pull_url.HD1 ||
                    streamData.flv_pull_url.SD1 ||
                    streamData.flv_pull_url.SD2;

                if (!streamUrl && typeof streamData.flv_pull_url === 'string') {
                    streamUrl = streamData.flv_pull_url;
                }
            }

            if (streamUrl && flvjs.isSupported()) {
                console.log("Found FLV URL:", streamUrl);
                setDebugMsg(`Attempting to play FLV: ${streamUrl.substring(0, 30)}...`);

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
                        setDebugMsg("Playing native stream!");
                    }).catch(err => {
                        console.error("Play error:", err);
                        // If autoplay is blocked, show a manual play button but keep the player active
                        if (err.name === 'NotAllowedError' || err.message.includes('play() request was interrupted')) {
                            setIsPlaying(true); // Show the video element
                            setShowPlayButton(true); // Show overlay button
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
                console.log("No usable FLV URL found or FLV not supported.");
                setError("No direct stream available.");
                setDebugMsg("No valid FLV URL found in data.");
            }
        } else {
            setDebugMsg("Waiting for stream info...");
        }
    }, [roomInfo]);

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

    return (
        <div className="w-full h-full bg-black relative flex flex-col overflow-hidden group">
            {/* Native Player */}
            <video
                ref={videoRef}
                className={`w-full h-full object-contain ${isPlaying ? 'block' : 'hidden'}`}
                controls
                muted // Muted needed for autoplay often
            />

            {/* Manual Play Overlay (for Autoplay Blocked) */}
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

            {/* Fallback Iframe (only if not playing native AND not waiting for manual play) */}
            {!isPlaying && (
                <div className="w-full h-full relative">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full border-0"
                        allowFullScreen
                        title="TikTok Live"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin"
                    />

                    {/* Overlay */}
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
