import React from 'react';

const GiftLog = ({ gifts, ranking }) => {
    return (
        <div className="flex flex-col h-full bg-gray-800">
            {/* Top Half: Gift Log (70%) */}
            <div className="h-[70%] flex flex-col border-b border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 font-bold text-lg">Recent Gifts</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {gifts.map((gift, index) => (
                        <div key={index} className="text-sm flex items-start gap-3 bg-gray-700/30 p-2 rounded">
                            <img src={gift.giftPictureUrl || gift.profilePictureUrl} alt="gift" className="w-10 h-10 object-contain" />
                            <div className="flex-1">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <img
                                            src={gift.profilePictureUrl}
                                            alt="user"
                                            className="inline-block w-5 h-5 rounded-full object-cover mr-1 align-sub"
                                        />
                                        <span className="font-bold text-yellow-400">{gift.nickname || gift.uniqueId}</span>
                                        <span className="text-gray-300"> sent </span>
                                        <span className="font-bold text-pink-400">{gift.giftName}</span>
                                    </div>
                                    <div className="text-xs font-mono bg-gray-800 px-2 py-1 rounded text-yellow-500 flex items-center gap-1 shrink-0 whitespace-nowrap h-fit">
                                        <span>{gift.diamondCount}</span>
                                        <span>💎</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 mt-1 flex gap-2">
                                    <span className={`font-bold ${gift.combo ? 'text-orange-500 text-base' : ''}`}>x{gift.repeatCount}</span>
                                    <span>ID: {gift.giftId}</span>
                                    <span>Cost: {gift.diamondCount * gift.repeatCount}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Half: Ranking (30%) */}
            <div className="h-[30%] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-700 font-bold text-lg">Top Gifters</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {ranking.map((user, index) => (
                        <div key={user.uniqueId} className="flex items-center justify-between text-sm bg-gray-700/50 p-2 rounded">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="font-bold text-gray-400 shrink-0">#{index + 1}</span>
                                <img
                                    src={user.profilePictureUrl}
                                    alt="avatar"
                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                                <span className="font-bold truncate">{user.nickname || user.uniqueId}</span>
                            </div>
                            <div className="text-yellow-400 font-mono">{user.totalCoins} 🪙</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GiftLog;
