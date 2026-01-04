import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Search, Activity, Wifi, WifiOff, Settings, Volume2, VolumeX } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import ChatLog from './components/ChatLog';
import GiftLog from './components/GiftLog';
import GiftDisplay from './components/GiftDisplay';
import GiftAnimation from './components/GiftAnimation';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

// Simple beep sound as Data URI to avoid external dependencies for now
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; // Truncated placeholder, will use a proper short beep in actual code
// Actually, let's use a real short beep base64. 
// This is a very short "ding"
const CONNECTION_SOUND_URI = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAB0AAAAAAAAAAAB0AAAAAAHAAAAB0AAAAAAAAAAAAAAAB0AAAAAAHAAAAB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATdMfAAAAACnK18AAACqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AAAAqFv4AAAAp2v4AAAAqGv4AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA";
// Note: The above is just a placeholder string pattern. I will use a generated beep function or a proper small base64 for a "ding" in the actual implementation to be safe and clean.
// Better approach: Web Audio API oscillator for a simple beep if no file provided.
// Let's use a simple Oscillator for "Beep" to ensure it works without file issues.

// DingDongDingDong sound generator
// Sound player using downloaded file (Doorbell Ding-Dong)
// DingDongDingDong sound generator
// Sound player using downloaded file (Doorbell Ding-Dong)
const playDingDong = (volume) => {
    try {
        const audio = new Audio('/ding.mp3');
        audio.volume = volume;
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Play again shortly after (overlap to avoid silence/delay)
                    setTimeout(() => {
                        const audio2 = new Audio('/ding.mp3');
                        audio2.volume = volume;
                        audio2.play().catch(e => console.error("Play 2 failed", e));
                    }, 800); // 800ms delay for tighter repetition
                })
                .catch(e => console.error("Play failed", e));
        }
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

// Sound player using embedded Base64 (To prevent download dialogs/MIME issues)
const _bad_playDingDong = (volume) => {
    try {
        // Embed the MP3 as base64
        const soundUri = "data:audio/mp3;base64,//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AAAAAAHAAAAB0AA//uQZAAABUQUcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABTb3VuZEpheS5jb20gU291bmQgRWZmZWN0cwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        const audio = new Audio(soundUri);
        audio.volume = volume;
        audio.play().catch(e => console.error("Play failed", e));
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

// Old synth (renamed/deprecated)
const _playDingDong = (volume) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const now = ctx.currentTime;

        // Define notes: High (C6 ~ 1046.5Hz), Low (G5 ~ 783.99Hz)
        // Sequence: High - Low - High - Low
        const notes = [
            { freq: 1046.5, time: 0, duration: 0.2 },
            { freq: 783.99, time: 0.4, duration: 0.4 },
            { freq: 1046.5, time: 0.9, duration: 0.2 },
            { freq: 783.99, time: 1.3, duration: 0.4 }
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Use triangle wave for a more bell-like "ding" sound
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.time);

            // Envelope for bell shape (sharp attack, exponential decay)
            gain.gain.setValueAtTime(0, now + note.time);
            gain.gain.linearRampToValueAtTime(volume, now + note.time + 0.02); // Sharp Attack
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.time + note.duration); // Decay

            osc.start(now + note.time);
            osc.stop(now + note.time + note.duration + 0.1);
        });

    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const playBeep = (volume) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const StatusDisplay = ({ status }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!status.nextRetryTime) {
            setTimeLeft(0);
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.ceil((status.nextRetryTime - now) / 1000);
            setTimeLeft(Math.max(0, diff));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [status.nextRetryTime, status.status]);

    const statusColor =
        status.status === 'connected' ? 'text-green-400' :
            status.status === 'connecting' ? 'text-yellow-400' :
                'text-gray-400';

    return (
        <span className={statusColor}>
            {status.message}
            {timeLeft > 0 && status.status === 'offline' && (
                <span className="ml-1 font-mono font-bold text-yellow-500">
                    ({timeLeft}s)
                </span>
            )}
        </span>
    );
};

function App() {
    const [username, setUsername] = useState('');
    const [activeUser, setActiveUser] = useState(null);
    const [status, setStatus] = useState({ status: 'disconnected', message: 'Enter a username to start' });
    const [roomInfo, setRoomInfo] = useState(null);
    const [chats, setChats] = useState([]);
    const [gifts, setGifts] = useState([]);
    const [ranking, setRanking] = useState([]);
    const [stats, setStats] = useState({ viewers: 0, likes: 0, diamonds: 0 });
    const [chatFilters, setChatFilters] = useState({
        showLikes: false,
        showShares: false,
        showJoins: false
    });

    const [connectionSettings, setConnectionSettings] = useState({
        enableAutoReconnect: false,
        retryInterval: 10000,
        chatHistoryLimit: 5000,
        giftHistoryLimit: 5000
    });

    const [soundSettings, setSoundSettings] = useState({
        enabled: true,
        volume: 0.5
    });

    // Video Player Volume State (Default 50% or saved)
    const [videoVolume, setVideoVolume] = useState(() => {
        const saved = localStorage.getItem('tiktok_video_volume');
        return saved !== null ? parseFloat(saved) : 0.5;
    });

    const [showConnectionSettings, setShowConnectionSettings] = useState(false);
    const settingsRef = useRef(null);
    // Ref to access latest settings in socket callbacks without re-subscribing
    const connectionSettingsRef = useRef(connectionSettings);
    const soundSettingsRef = useRef(soundSettings);

    // Removed the separate useEffect for loading volume since we now do it lazily in useState

    // Save video volume on change
    useEffect(() => {
        localStorage.setItem('tiktok_video_volume', videoVolume);
    }, [videoVolume]);

    useEffect(() => {
        connectionSettingsRef.current = connectionSettings;
    }, [connectionSettings]);

    useEffect(() => {
        soundSettingsRef.current = soundSettings;
    }, [soundSettings]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowConnectionSettings(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Keep track of ranking in a ref to avoid dependency loops, then update state
    const rankingMap = useRef(new Map());
    const lastGiftRef = useRef(new Map());
    const processedMsgIds = useRef(new Set());
    const userCache = useRef(new Map()); // Cache { gifterLevel, teamMemberLevel, nickname, profilePictureUrl }

    // Helper to update cache and enrich data
    const processUserData = (data) => {
        const uniqueId = data.uniqueId;
        if (!uniqueId) return data;

        const currentCache = userCache.current.get(uniqueId) || {};

        // Extract level from various possible locations in incoming data
        const incomingLevel = data.userDetails?.userAttributes?.gifterLevel ||
            data.userAttributes?.gifterLevel ||
            data.gifterLevel ||
            0;

        // Extract team member level
        const incomingTeamLevel = data.teamMemberLevel ||
            data.userDetails?.userAttributes?.teamMemberLevel ||
            0;

        // Update cache if we have new substantial info
        const newCache = { ...currentCache };
        if (incomingLevel > 0) newCache.gifterLevel = incomingLevel;
        if (incomingTeamLevel > 0) newCache.teamMemberLevel = incomingTeamLevel;
        if (data.nickname) newCache.nickname = data.nickname;
        if (data.profilePictureUrl) newCache.profilePictureUrl = data.profilePictureUrl;

        userCache.current.set(uniqueId, newCache);

        // Return enriched data
        // If incoming has no level (or 0) but cache has it, use cache
        let finalLevel = incomingLevel;
        if (finalLevel === 0 && newCache.gifterLevel > 0) {
            finalLevel = newCache.gifterLevel;
        }

        let finalTeamLevel = incomingTeamLevel;
        if (finalTeamLevel === 0 && newCache.teamMemberLevel > 0) {
            finalTeamLevel = newCache.teamMemberLevel;
        }

        // Attach standardized level to data for easier access in components
        return { ...data, gifterLevel: finalLevel, teamMemberLevel: finalTeamLevel };
    };

    // Gift Display Queue
    const [giftQueue, setGiftQueue] = useState([]);
    const [currentGift, setCurrentGift] = useState(null);

    // Animation Queue (SVGA)
    const [animationQueue, setAnimationQueue] = useState([]);
    const [currentAnimation, setCurrentAnimation] = useState(null);

    // Process Gift Queue
    useEffect(() => {
        if (!currentGift && giftQueue.length > 0) {
            const nextGift = giftQueue[0];
            setCurrentGift(nextGift);
            setGiftQueue(prev => prev.slice(1));
        }
    }, [currentGift, giftQueue]);

    // Process Animation Queue
    useEffect(() => {
        if (!currentAnimation && animationQueue.length > 0) {
            const nextAnimation = animationQueue[0];
            setCurrentAnimation(nextAnimation);
            setAnimationQueue(prev => prev.slice(1));
        }
    }, [currentAnimation, animationQueue]);

    const handleGiftComplete = () => {
        setCurrentGift(null);
    };

    const handleAnimationComplete = () => {
        setCurrentAnimation(null);
    };

    useEffect(() => {
        // 1. Check URL Params for room/account
        const params = new URLSearchParams(window.location.search);
        let urlRoom = params.get('room') || params.get('account');


        // 2. Load saved settings
        const savedUsername = localStorage.getItem('tiktok_username');
        const savedFilters = localStorage.getItem('tiktok_chat_filters');
        const savedConnectionSettings = localStorage.getItem('tiktok_connection_settings');
        const savedSoundSettings = localStorage.getItem('tiktok_sound_settings');

        // Determine effective username: URL param > LocalStorage
        const effectiveUsername = urlRoom || savedUsername;

        if (effectiveUsername) {
            setUsername(effectiveUsername);
            // Auto-connect mechanism
            setTimeout(() => {
                const settings = savedConnectionSettings ? JSON.parse(savedConnectionSettings) : { enableAutoReconnect: false, retryInterval: 10000, chatHistoryLimit: 5000, giftHistoryLimit: 5000 };
                handleConnect(null, effectiveUsername, settings);
            }, 500);
        }

        if (savedFilters) {
            try {
                setChatFilters(JSON.parse(savedFilters));
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }

        if (savedConnectionSettings) {
            try {
                const parsed = JSON.parse(savedConnectionSettings);
                setConnectionSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse saved connection settings", e);
            }
        }

        if (savedSoundSettings) {
            try {
                const parsed = JSON.parse(savedSoundSettings);
                setSoundSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse sound settings", e);
            }
        }


        socket.on('connect', () => {
            console.log('Connected to backend');
        });

        socket.on('status', (data) => {
            setStatus(data);
            // Play sound if connected and enabled
            if (data.status === 'connected' && soundSettingsRef.current.enabled) {
                playDingDong(soundSettingsRef.current.volume);
            }
        });

        socket.on('roomInfo', (data) => {
            console.log('Received room info:', data);
            setRoomInfo(data);
        });

        socket.on('roomUser', (data) => {
            setStats(prev => ({
                ...prev,
                viewers: data.viewerCount
            }));
        });

        socket.on('chat', (data) => {
            const enrichedData = processUserData(data);

            if (data.type === 'like') {
                setStats(prev => ({
                    ...prev,
                    likes: data.totalLikeCount
                }));
            }
            setChats(prev => {
                const limit = connectionSettingsRef.current.chatHistoryLimit || 5000;
                const newList = [...prev, enrichedData];
                // If limit is 0, keep all (infinite history)
                if (limit > 0 && newList.length > limit) {
                    return newList.slice(-limit);
                }
                return newList;
            });
        });



        socket.on('gift', (rawData) => {
            const data = processUserData(rawData); // Enrich gift data too

            // Deduplicate by msgId
            if (data.msgId && processedMsgIds.current.has(data.msgId)) {
                return;
            }
            if (data.msgId) {
                processedMsgIds.current.add(data.msgId);
                // Keep set size manageable
                if (processedMsgIds.current.size > 500) {
                    const first = processedMsgIds.current.values().next().value;
                    processedMsgIds.current.delete(first);
                }
            }

            const giftKey = `${data.uniqueId}-${data.giftId}`;
            const lastGift = lastGiftRef.current.get(giftKey);
            const now = Date.now();
            let addedCoins = 0;
            let addedCount = 0;

            // Check for animation (Logic: if it has an animation URL or is "expensive" enough)
            // Note: Since we don't have price, we check specific fields or assume high combo implies celebration
            const hasAnimation = data.extendedGiftInfo?.animation_url || data.diamondCount >= 99;
            // Deduplicate animation trigger? 
            // We might want to trigger it only on the FIRST of the streak, or every X combo
            if (hasAnimation) {
                // Simple logic: Trigger if new streak or repeatCount % 10 === 0
                // Also ensure it's not already in queue to avoid spam?
                // For now, let's queue it if it's a "significant" update
            }

            // DEMO: If gift name contains "Rose" or specific test case, trigger animation with sample URL
            // This is just to verify functionality without expensive gifts
            if (data.giftName && data.giftName.toLowerCase().includes('heart') && data.repeatCount === 1) {
                // Mock animation for testing locally
                setAnimationQueue(prev => [...prev, {
                    ...data,
                    url: "https://github.com/yyued/SVGA-Samples/blob/master/angel.svga?raw=true" // Public sample
                }]);
            } else if (hasAnimation && (data.repeatCount === 1 || data.repeatCount % 50 === 0)) {
                setAnimationQueue(prev => [...prev, data]);
            }

            if (lastGift) {
                // If groupId matches, it is strictly the same streak
                if (data.groupId && lastGift.groupId && data.groupId === lastGift.groupId) {
                    if (data.repeatCount > lastGift.repeatCount) {
                        addedCoins = (data.repeatCount - lastGift.repeatCount) * (data.diamondCount || 0);
                        addedCount = data.repeatCount - lastGift.repeatCount;
                    } else {
                        // Duplicate or out-of-order packet for same streak
                        return;
                    }
                }
                // Fallback for missing groupId: Use time + repeatCount heuristic
                else {
                    const timeDiff = now - lastGift.timestamp;

                    // FIX: Ignore "phantom" x1 packets that arrive after a batch x100 packet
                    // If we receive a count of 1 shortly after a high count, it's likely an out-of-order "start" packet
                    if (timeDiff < 3000 && data.repeatCount === 1 && lastGift.repeatCount >= 10) {
                        return;
                    }

                    // If same gift type from same user
                    if (timeDiff < 5000 && data.repeatCount === lastGift.repeatCount) {
                        // Likely duplicate packet (retry) even if groupId missing
                        return;
                    }
                    else if (timeDiff < 5000 && data.repeatCount > lastGift.repeatCount) {
                        // Continuation (assumed)
                        addedCoins = (data.repeatCount - lastGift.repeatCount) * (data.diamondCount || 0);
                        addedCount = data.repeatCount - lastGift.repeatCount;
                    } else {
                        // New streak
                        addedCoins = data.repeatCount * (data.diamondCount || 0);
                        addedCount = data.repeatCount;
                    }
                }
            } else {
                // New gift sequence
                addedCoins = data.repeatCount * (data.diamondCount || 0);
                addedCount = data.repeatCount;
            }

            // Update lastGiftRef for this user+gift combo
            lastGiftRef.current.set(giftKey, { ...data, timestamp: now });

            // --- GIFT DISPLAY LOGIC ---
            // If the current gift displayed is the same user & gift, update it directly (combo)
            // Otherwise add to queue
            setCurrentGift(current => {
                if (current && current.uniqueId === data.uniqueId && current.giftId === data.giftId) {
                    // Return updated object to trigger re-render of GiftDisplay
                    return { ...current, repeatCount: data.repeatCount };
                }

                // If not current, add to queue
                setGiftQueue(prev => {
                    // Check if last in queue is same, if so update that one
                    if (prev.length > 0) {
                        const lastInQueue = prev[prev.length - 1];
                        if (lastInQueue.uniqueId === data.uniqueId && lastInQueue.giftId === data.giftId) {
                            const newQueue = [...prev];
                            newQueue[newQueue.length - 1] = { ...lastInQueue, repeatCount: data.repeatCount };
                            return newQueue;
                        }
                    }
                    // Limit queue size to prevent backlog
                    if (prev.length > 10) return prev;
                    return [...prev, data];
                });

                return current;
            });

            // Update Visual Log
            setGifts(prev => {
                const currentGifts = [...prev];

                // Find existing visual entry for this user and gift within 3 seconds
                const existingIndex = currentGifts.findIndex(g =>
                    g.uniqueId === data.uniqueId &&
                    g.giftId === data.giftId &&
                    (now - (g.updatedAt || now)) < 3000 // 3 second window
                );

                if (existingIndex !== -1) {
                    // Update existing entry
                    const existing = currentGifts[existingIndex];
                    // Remove from current position
                    currentGifts.splice(existingIndex, 1);
                    // Add to top with updated count
                    currentGifts.unshift({
                        ...existing,
                        repeatCount: (existing.visualCount || existing.repeatCount) + addedCount,
                        visualCount: (existing.visualCount || existing.repeatCount) + addedCount,
                        combo: true,
                        updatedAt: now
                    });
                    return currentGifts;
                } else {
                    // Add new entry
                    return [{
                        ...data,
                        visualCount: addedCount,
                        repeatCount: data.repeatCount,
                        updatedAt: now
                    }, ...prev];

                    // Slice only if limit > 0
                    const limit = connectionSettingsRef.current.giftHistoryLimit || 5000;
                    if (limit > 0) {
                        return newList.slice(0, limit);
                    }
                    return newList;
                }
            });

            // Update ranking
            const current = rankingMap.current.get(data.uniqueId) || {
                uniqueId: data.uniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl,
                totalCoins: 0
            };

            current.totalCoins += addedCoins;
            current.nickname = data.nickname;
            current.profilePictureUrl = data.profilePictureUrl;

            rankingMap.current.set(data.uniqueId, current);

            // Convert to sorted array
            const sorted = Array.from(rankingMap.current.values())
                .sort((a, b) => b.totalCoins - a.totalCoins)
                .slice(0, 50); // Top 50

            setRanking(sorted);

            // Update diamond count
            setStats(prev => ({
                ...prev,
                diamonds: prev.diamonds + addedCoins
            }));
        });

        return () => {
            socket.off('connect');
            socket.off('status');
            socket.off('roomInfo');
            socket.off('chat');
            socket.off('gift');
            socket.off('roomUser');
        };
    }, []);

    const handleConnect = (e, storedUsername = null, specificSettings = null) => {
        if (e) e.preventDefault();
        const userToConnect = storedUsername || username;
        if (!userToConnect) return;

        // Save to localStorage
        localStorage.setItem('tiktok_username', userToConnect);
        if (!username) setUsername(userToConnect);

        // Reset state
        setChats([]);
        setGifts([]);
        setRanking([]);
        setRoomInfo(null);
        setStats({ viewers: 0, likes: 0, diamonds: 0 });
        rankingMap.current.clear();
        lastGiftRef.current.clear(); // Reset last gift map
        processedMsgIds.current.clear(); // Reset processed msg ids
        setActiveUser(userToConnect);

        const settingsToSend = specificSettings || connectionSettings;
        socket.emit('join', { username: userToConnect, options: settingsToSend });
    };

    const handleToggleFilter = (key) => {
        setChatFilters(prev => {
            const newFilters = { ...prev, [key]: !prev[key] };
            localStorage.setItem('tiktok_chat_filters', JSON.stringify(newFilters));
            return newFilters;
        });
    };

    const updateConnectionSettings = (key, value) => {
        setConnectionSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem('tiktok_connection_settings', JSON.stringify(newSettings));
            return newSettings;
        });
    };

    const updateSoundSettings = (key, value) => {
        setSoundSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem('tiktok_sound_settings', JSON.stringify(newSettings));
            // Trigger a test beep if volume changes
            if (key === 'volume' && newSettings.enabled) {
                // Debounce this in real app, but for now it's fine
                // playBeep(value); 
            }
            return newSettings;
        });
    };


    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-md z-50">
                <div className="flex items-center gap-2">
                    <Activity className="text-pink-500" />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
                        TikTok Live Monitor
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <form onSubmit={handleConnect} className="flex items-center gap-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Enter TikTok Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-gray-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-sm font-bold transition-colors shadow-lg hover:shadow-blue-500/50"
                        >
                            Monitor
                        </button>
                    </form>

                    {/* Connection Settings Button */}
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setShowConnectionSettings(!showConnectionSettings)}
                            className={`p-2 rounded-full transition-colors ${showConnectionSettings ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                            title="Connection Settings"
                        >
                            <Settings size={20} />
                        </button>

                        {showConnectionSettings && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Audio Settings</h3>

                                <div className="space-y-4 mb-6 pb-6 border-b border-gray-700">
                                    <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            {soundSettings.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                            <span>Play Sound on Connect</span>
                                        </div>
                                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                checked={soundSettings.enabled}
                                                onChange={(e) => updateSoundSettings('enabled', e.target.checked)}
                                                className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400 right-6 top-1"
                                                style={{ right: soundSettings.enabled ? '2px' : '22px' }}
                                            />
                                            <div className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${soundSettings.enabled ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                        </div>
                                    </label>

                                    <div className={`space-y-1 transition-opacity ${soundSettings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                        <div className="flex justify-between items-center text-xs text-gray-400">
                                            <span>Volume</span>
                                            <span>{Math.round(soundSettings.volume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={soundSettings.volume}
                                            onChange={(e) => updateSoundSettings('volume', parseFloat(e.target.value))}
                                            onMouseUp={() => soundSettings.enabled && playDingDong(soundSettings.volume)}
                                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => playDingDong(soundSettings.volume)}
                                            className="mt-2 w-full px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white font-medium transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Volume2 size={12} /> Test Sound
                                        </button>
                                    </div>

                                    {/* Video Volume Slider */}
                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                        <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                                            <span>Video Volume</span>
                                            <span>{Math.round(videoVolume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={videoVolume}
                                            onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                        />
                                    </div>
                                </div>


                                <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Connection Settings</h3>

                                <div className="space-y-4">
                                    <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer">
                                        <span>Auto Reconnect</span>
                                        <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                checked={connectionSettings.enableAutoReconnect}
                                                onChange={(e) => updateConnectionSettings('enableAutoReconnect', e.target.checked)}
                                                className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400 right-6 top-1"
                                                style={{ right: connectionSettings.enableAutoReconnect ? '2px' : '22px' }}
                                            />
                                            <div className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${connectionSettings.enableAutoReconnect ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                        </div>
                                    </label>

                                    <div className={`space-y-1 transition-opacity ${connectionSettings.enableAutoReconnect ? 'opacity-100' : 'opacity-50'}`}>
                                        <label className="block text-xs text-gray-400">Reconnect Interval (ms)</label>
                                        <input
                                            type="number"
                                            min="2000"
                                            step="1000"
                                            disabled={!connectionSettings.enableAutoReconnect}
                                            value={connectionSettings.retryInterval}
                                            onChange={(e) => updateConnectionSettings('retryInterval', parseInt(e.target.value) || 10000)}
                                            className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-gray-500">Minimum 2000ms</p>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="block text-xs text-gray-400">Msgs to Keep</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="100"
                                            value={connectionSettings.chatHistoryLimit !== undefined ? connectionSettings.chatHistoryLimit : 5000}
                                            onChange={(e) => updateConnectionSettings('chatHistoryLimit', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <p className="text-[10px] text-gray-500">Set to 0 for infinite history</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-xs text-gray-400">Gifts to Keep</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="100"
                                            value={connectionSettings.giftHistoryLimit !== undefined ? connectionSettings.giftHistoryLimit : 5000}
                                            onChange={(e) => updateConnectionSettings('giftHistoryLimit', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <p className="text-[10px] text-gray-500">Set to 0 for infinite history</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-4 mr-4 bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600">
                        <span className="font-bold text-gray-300">Viewers: <span className="text-white">{stats.viewers.toLocaleString()}</span></span>
                        <span className="font-bold text-gray-300">Likes: <span className="text-white">{stats.likes.toLocaleString()}</span></span>
                        <span className="font-bold text-gray-300">Total 💎: <span className="text-yellow-400">{stats.diamonds.toLocaleString()}</span></span>
                    </div>

                    {status.status === 'connected' ? (
                        <Wifi className="text-green-400 w-4 h-4" />
                    ) : (
                        <WifiOff className="text-red-400 w-4 h-4" />
                    )}
                    <StatusDisplay status={status} />
                </div>
            </header >

            {/* Main Content - 3 Pane Layout */}
            < main className="flex-1 flex overflow-hidden" >
                {/* Left: Video (43%) */}
                < div className="w-[43%] border-r border-gray-700 bg-black relative" >
                    <VideoPlayer
                        username={activeUser}
                        roomInfo={roomInfo}
                        socket={socket}
                        volume={videoVolume}
                        onVolumeChange={(newVol) => setVideoVolume(newVol)}
                    />
                    {currentGift && <GiftDisplay gift={currentGift} onComplete={handleGiftComplete} />}
                    {currentAnimation && <GiftAnimation gift={currentAnimation} onComplete={handleAnimationComplete} />}
                </div >

                {/* Middle: Chat (33%) */}
                < div className="w-[33%] border-r border-gray-700" >
                    <ChatLog
                        chats={chats}
                        filters={chatFilters}
                        onToggleFilter={handleToggleFilter}
                    />
                </div >

                {/* Right: Gifts & Ranking (24%) */}
                < div className="w-[24%]" >
                    <GiftLog gifts={gifts} ranking={ranking} />
                </div >
            </main>
        </div>
    );
}

export default App;
