import React, { useEffect, useState } from 'react';

const GiftDisplay = ({ gift, onComplete }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [comboScale, setComboScale] = useState(1);

    useEffect(() => {
        // Trigger entrance animation
        setIsVisible(true);

        // Auto-dismiss after 3 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            // Wait for exit animation to finish before calling onComplete
            setTimeout(onComplete, 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    // Effect to trigger combo pulse when repeatCount changes
    useEffect(() => {
        setComboScale(1.5);
        const timer = setTimeout(() => setComboScale(1), 150);
        return () => clearTimeout(timer);
    }, [gift?.repeatCount]);

    if (!gift) return null;

    return (
        <div
            className={`absolute bottom-24 left-4 z-40 transition-all duration-300 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
        >
            <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full p-2 pr-6 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                {/* Avatar */}
                <div className="relative">
                    <img
                        src={gift.profilePictureUrl}
                        alt={gift.nickname}
                        className="w-10 h-10 rounded-full border-2 border-pink-500"
                    />
                </div>

                {/* Text Info */}
                <div className="ml-3 flex flex-col">
                    <span className="text-white font-bold text-sm leading-tight text-shadow-sm">
                        {gift.nickname}
                    </span>
                    <span className="text-pink-300 text-xs">
                        Sent {gift.giftName || "a Gift"}
                    </span>
                </div>

                {/* Gift Image (Larger and overlapping) */}
                <div className="relative w-12 h-12 ml-2 -mr-4">
                    {/* Fallback to emoji if no URL, but we expect URL */}
                    {gift.giftPictureUrl ? (
                        <img
                            src={gift.giftPictureUrl}
                            alt="gift"
                            className="w-full h-full object-contain drop-shadow-lg"
                        />
                    ) : (
                        <span className="text-2xl">🎁</span>
                    )}
                </div>

                {/* Combo Counter */}
                <div
                    className="ml-6 font-black italic text-2xl text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                    style={{
                        transform: `scale(${comboScale})`,
                        transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                >
                    x{gift.repeatCount}
                </div>
            </div>
        </div>
    );
};

export default GiftDisplay;
