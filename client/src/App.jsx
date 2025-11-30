import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Search, Activity, Wifi, WifiOff, Settings } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import ChatLog from './components/ChatLog';
import GiftLog from './components/GiftLog';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

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
        retryInterval: 10000
    });
    const [showConnectionSettings, setShowConnectionSettings] = useState(false);

    // Keep track of ranking in a ref to avoid dependency loops, then update state
    const rankingMap = useRef(new Map());
    const lastGiftRef = useRef(null);

    useEffect(() => {
        // Load saved username and filters
        const savedUsername = localStorage.getItem('tiktok_username');
        const savedFilters = localStorage.getItem('tiktok_chat_filters');
        const savedConnectionSettings = localStorage.getItem('tiktok_connection_settings');

        if (savedUsername) {
            setUsername(savedUsername);
            // Auto-connect after a short delay to ensure socket is ready
            setTimeout(() => {
                // Use default or saved settings for auto-connect
                const settings = savedConnectionSettings ? JSON.parse(savedConnectionSettings) : { enableAutoReconnect: false, retryInterval: 10000 };
                handleConnect(null, savedUsername, settings);
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
                setConnectionSettings(JSON.parse(savedConnectionSettings));
            } catch (e) {
                console.error("Failed to parse saved connection settings", e);
            }
        }


        socket.on('connect', () => {
            console.log('Connected to backend');
        });

        socket.on('status', (data) => {
            setStatus(data);
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
            if (data.type === 'like') {
                setStats(prev => ({
                    ...prev,
                    likes: data.totalLikeCount
                }));
            }
            setChats(prev => [...prev.slice(-199), data]); // Keep last 200 messages
        });

        socket.on('gift', (data) => {
            const lastGift = lastGiftRef.current;
            let addedCoins = 0;

            // Check if this is a combo update (same user, same giftId as last received)
            if (lastGift && lastGift.uniqueId === data.uniqueId && lastGift.giftId === data.giftId) {
                // Calculate delta: (New Count - Old Count) * Cost
                // Ensure we don't add negative if packets arrive out of order (unlikely but safe)
                const countDiff = Math.max(0, data.repeatCount - lastGift.repeatCount);
                addedCoins = countDiff * (data.diamondCount || 0);
            } else {
                // New gift sequence
                addedCoins = data.repeatCount * (data.diamondCount || 0);
            }

            // Update lastGiftRef
            lastGiftRef.current = data;

            // Update Visual Log
            setGifts(prev => {
                const currentGifts = [...prev];
                // Check the visual head of the list for grouping
                const visualLastGift = currentGifts[0];

                if (visualLastGift && visualLastGift.uniqueId === data.uniqueId && visualLastGift.giftId === data.giftId) {
                    currentGifts[0] = {
                        ...data,
                        repeatCount: data.repeatCount,
                        combo: true
                    };
                    return currentGifts;
                } else {
                    return [data, ...prev].slice(0, 50);
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
        lastGiftRef.current = null; // Reset last gift ref
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

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10">
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
                    <div className="relative">
                        <button
                            onClick={() => setShowConnectionSettings(!showConnectionSettings)}
                            className={`p-2 rounded-full transition-colors ${showConnectionSettings ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                            title="Connection Settings"
                        >
                            <Settings size={20} />
                        </button>

                        {showConnectionSettings && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 z-50">
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

                                    {connectionSettings.enableAutoReconnect && (
                                        <div className="space-y-1">
                                            <label className="block text-xs text-gray-400">Reconnect Interval (ms)</label>
                                            <input
                                                type="number"
                                                min="2000"
                                                step="1000"
                                                value={connectionSettings.retryInterval}
                                                onChange={(e) => updateConnectionSettings('retryInterval', parseInt(e.target.value) || 10000)}
                                                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                                            />
                                            <p className="text-[10px] text-gray-500">Minimum 2000ms</p>
                                        </div>
                                    )}
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
                    <span className={
                        status.status === 'connected' ? 'text-green-400' :
                            status.status === 'connecting' ? 'text-yellow-400' : 'text-gray-400'
                    }>
                        {status.message}
                    </span>
                </div>
            </header>

            {/* Main Content - 3 Pane Layout */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left: Video (43%) */}
                <div className="w-[43%] border-r border-gray-700 bg-black">
                    <VideoPlayer username={activeUser} roomInfo={roomInfo} />
                </div>

                {/* Middle: Chat (33%) */}
                <div className="w-[33%] border-r border-gray-700">
                    <ChatLog
                        chats={chats}
                        filters={chatFilters}
                        onToggleFilter={handleToggleFilter}
                    />
                </div>

                {/* Right: Gifts & Ranking (24%) */}
                <div className="w-[24%]">
                    <GiftLog gifts={gifts} ranking={ranking} />
                </div>
            </main>
        </div>
    );
}

export default App;
