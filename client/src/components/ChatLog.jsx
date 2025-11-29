import React, { useEffect, useRef } from 'react';

const ChatLog = ({ chats }) => {
    const bottomRef = useRef(null);

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

    return (
        <div className="flex flex-col h-full bg-gray-800 border-r border-gray-700">
            <div className="p-4 border-b border-gray-700 font-bold text-lg">Chat Log</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {chats.map((chat, index) => (
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
                                        <span className="font-bold text-blue-400 hover:underline">{chat.nickname}</span>
                                    ), "inline-block mr-1")}
                                    <span className="text-gray-200">: {chat.comment}</span>
                                </>
                            )}
                            {chat.type === 'like' && (
                                <div className="text-gray-400 italic">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className="font-bold text-blue-300 hover:underline">{chat.nickname}</span>
                                    ))} liked the LIVE
                                </div>
                            )}
                            {chat.type === 'share' && (
                                <div className="text-green-400 italic">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className="font-bold hover:underline">{chat.nickname}</span>
                                    ))} shared the LIVE
                                </div>
                            )}
                            {chat.type === 'join' && (
                                <div className="text-gray-500 text-sm">
                                    {renderUserLink(chat.uniqueId, (
                                        <span className="font-bold hover:underline">{chat.nickname}</span>
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
