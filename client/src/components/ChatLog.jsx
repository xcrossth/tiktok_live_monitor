import React, { useEffect, useRef, useState } from 'react';
import { Settings, ShieldCheck, Star } from 'lucide-react';

const ChatLog = ({ chats, filters = { showLikes: true, showShares: true, showJoins: true }, onToggleFilter }) => {
    const bottomRef = useRef(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chats]);

    const renderUserLink = (uniqueId, children, className = "") => (
        <a
            href={`https://www.tiktok.com/@${uniqueId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`hover:opacity-80 transition-opacity ${className}`}
        >
            {children}
        </a>
    );

    const filteredChats = chats.filter(chat => {
        if (chat.type === 'like' && !filters.showLikes) return false;
        if (chat.type === 'share' && !filters.showShares) return false;
        if (chat.type === 'join' && !filters.showJoins) return false;
        return true;
    });

    const getLevel = (chat) => {
        // Try to find level in various possible locations
        const level = chat.userDetails?.userAttributes?.gifterLevel ||
            chat.userAttributes?.gifterLevel ||
            chat.gifterLevel ||
            0;
        return level > 0 ? level : null;
    };

    const LevelBadge = ({ level }) => {
        if (!level) return null;

        // Dynamic color based on level (simplified logic)
        let bgColor = "bg-gray-600";
        if (level >= 10) bgColor = "bg-blue-600";
        if (level >= 20) bgColor = "bg-cyan-600";
        if (level >= 30) bgColor = "bg-green-600";
        if (level >= 40) bgColor = "bg-yellow-600";
        if (level >= 50) bgColor = "bg-orange-600";
        if (level >= 60) bgColor = "bg-red-600";

        return (
            <span className={`${bgColor} text-white text-[10px] font-bold px-1 py-0.5 rounded mr-1.5 inline-flex items-center justify-center min-w-[36px] align-middle gap-0.5`}>
                <Star size={10} fill="currentColor" className="text-yellow-300" />
                <span>{level}</span>
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700">
            <div className="p-3 border-b border-gray-700 bg-gray-800 flex justify-between items-center relative z-20">
                <h2 className="font-bold text-gray-100">Chat Log</h2>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                >
                    <Settings size={18} />
                </button>

                {/* Dropdown */}
                {isSettingsOpen && (
                    <div className="absolute right-2 top-10 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-48">
                        <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Chat Filters</h3>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white select-none">
                                <input
                                    type="checkbox"
                                    checked={filters.showLikes}
                                    onChange={() => onToggleFilter('showLikes')}
                                    className="rounded bg-gray-700 border-gray-600 text-pink-500 focus:ring-pink-500 focus:ring-offset-gray-800"
                                />
                                Show Likes
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white select-none">
                                <input
                                    type="checkbox"
                                    checked={filters.showShares}
                                    onChange={() => onToggleFilter('showShares')}
                                    className="rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-gray-800"
                                />
                                Show Shares
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white select-none">
                                <input
                                    type="checkbox"
                                    checked={filters.showJoins}
                                    onChange={() => onToggleFilter('showJoins')}
                                    className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                                />
                                Show Joins
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {filteredChats.map((chat, index) => (
                    <div key={index} className="text-base break-words flex items-start gap-3">
                        {renderUserLink(chat.uniqueId, (
                            <img
                                src={chat.profilePictureUrl}
                                alt="avatar"
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                        ))}

                        <div className="flex-1">
                            {chat.type === 'chat' && (
                                <>
                                    {/* Username hidden as requested, only Display Name shown */}
                                    {renderUserLink(chat.uniqueId, (
                                        <span className={`font-bold hover:underline ${chat.isModerator ? 'text-green-400' : 'text-blue-400'}`}>
                                            <LevelBadge level={getLevel(chat)} />
                                            {chat.isModerator && <ShieldCheck size={14} className="inline mr-1 -mt-0.5" />}
                                            {chat.nickname}
                                        </span>
                                    ), "inline-block mr-1")}
                                    <span className={chat.isModerator ? 'text-green-300' : 'text-gray-200'}>: {chat.comment}</span>
                                </>
                            )}
                            {chat.type === 'like' && (
                                <div className="text-gray-400 italic">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className={`font-bold hover:underline ${chat.isModerator ? 'text-green-400' : 'text-blue-300'}`}>
                                            <LevelBadge level={getLevel(chat)} />
                                            {chat.isModerator && <ShieldCheck size={14} className="inline mr-1 -mt-0.5" />}
                                            {chat.nickname}
                                        </span>
                                    ))} liked the LIVE
                                </div>
                            )}
                            {chat.type === 'share' && (
                                <div className="text-green-400 italic">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className={`font-bold hover:underline ${chat.isModerator ? 'text-green-400' : ''}`}>
                                            <LevelBadge level={getLevel(chat)} />
                                            {chat.isModerator && <ShieldCheck size={14} className="inline mr-1 -mt-0.5" />}
                                            {chat.nickname}
                                        </span>
                                    ))} shared the LIVE
                                </div>
                            )}
                            {chat.type === 'join' && (
                                <div className="text-gray-500 text-sm">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className={`font-bold hover:underline ${chat.isModerator ? 'text-green-400' : ''}`}>
                                            <LevelBadge level={getLevel(chat)} />
                                            {chat.isModerator && <ShieldCheck size={14} className="inline mr-1 -mt-0.5" />}
                                            {chat.nickname}
                                        </span>
                                    ))} joined
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default ChatLog;
