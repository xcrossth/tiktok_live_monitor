import React, { useEffect, useRef, useState } from 'react';
import SVGA from 'svgaplayerweb';

const GiftAnimation = ({ gift, onComplete }) => {
    const canvasRef = useRef(null);
    const playerRef = useRef(null);

    const [contentType, setContentType] = useState('svga'); // 'svga', 'video', 'image'
    const [proxyUrl, setProxyUrl] = useState(null);

    useEffect(() => {
        if (!gift) return;

        console.log("GiftAnimation received gift:", gift); // Debug logging

        // Determine URL
        const extended = gift.extendedGiftInfo || {};
        const staticInfo = gift.staticInfo || {}; // Enhanced info from server

        const originalUrl = extended.animation_url?.url_list?.[0] ||
            extended.resource_url?.url_list?.[0] ||
            extended.video_url?.url_list?.[0] ||
            extended.sticker_video_url?.url_list?.[0] ||
            extended.image?.url_list?.[0] ||
            staticInfo.animation_url?.url_list?.[0] ||
            staticInfo.video_url?.url_list?.[0] ||
            staticInfo.resource_url?.url_list?.[0] ||
            staticInfo.image?.url_list?.[0] ||
            gift.giftPictureUrl || // Fallback to icon
            gift.url;

        if (!originalUrl) {
            console.warn("No animation URL found for gift:", gift);
            onComplete();
            return;
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const url = `${backendUrl}/api/animation-proxy?url=${encodeURIComponent(originalUrl)}`;
        setProxyUrl(url);

        // Fetch HEAD to check content-type before rendering
        fetch(url, { method: 'HEAD' })
            .then(res => {
                const type = res.headers.get('content-type');

                // Helper to check extension
                const ext = originalUrl.split('?')[0].split('.').pop().toLowerCase();
                const isImageExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
                const isVideoExt = ['mp4', 'webm'].includes(ext);

                if (type && (type.includes('mp4') || type.includes('video'))) {
                    setContentType('video');
                } else if (type && (type.includes('webp') || type.includes('image') || type.includes('png') || type.includes('jpeg'))) {
                    setContentType('image');
                } else {
                    // Fallback: If header is generic or missing, trust the URL extension
                    if (isImageExt) {
                        console.log("Header generic, using extension as Image:", ext);
                        setContentType('image');
                    } else if (isVideoExt) {
                        console.log("Header generic, using extension as Video:", ext);
                        setContentType('video');
                    } else {
                        // Only default to SVGA if we really don't know
                        setContentType('svga');
                    }
                }
            })
            .catch(err => {
                console.warn("Head request failed, checking extension...", err);
                const ext = originalUrl.split('?')[0].split('.').pop().toLowerCase();
                if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
                    setContentType('image');
                } else if (['mp4', 'webm'].includes(ext)) {
                    setContentType('video');
                } else {
                    setContentType('svga');
                }
            });

    }, [gift]);

    useEffect(() => {
        if (!proxyUrl || contentType !== 'svga' || !canvasRef.current) return;

        // SVGA Logic
        try {
            const player = new SVGA.Player(canvasRef.current);
            const parser = new SVGA.Parser();

            playerRef.current = player;

            parser.load(proxyUrl, (videoItem) => {
                player.setVideoItem(videoItem);
                player.startAnimation();
                player.onFinished(onComplete);
            }, (err) => {
                console.error("SVGA Load Error:", err);
                onComplete();
            });

        } catch (err) {
            console.error("SVGA Init Error:", err);
            onComplete();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.stopAnimation();
                playerRef.current.clear();
            }
        };
    }, [proxyUrl, contentType]);

    if (!gift || !proxyUrl) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            {contentType === 'svga' && (
                <canvas
                    ref={canvasRef}
                    className="w-full h-full object-contain"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
            )}
            {contentType === 'video' && (
                <video
                    src={proxyUrl}
                    autoPlay
                    muted
                    onEnded={onComplete}
                    className="w-full h-full object-contain"
                />
            )}
            {contentType === 'image' && (
                <img
                    src={proxyUrl}
                    alt="Gift Animation"
                    className="w-full h-full object-contain"
                />
            )}
        </div>
    );
};

export default GiftAnimation;
