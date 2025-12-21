
import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

export const ChristmasBGM = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Warm, healing Christmas instrumental (Royalty Free)
    // Source: Local Jingle Bells (Upbeat & Warm)
    const AUDIO_URL = "/jingle-bells.mp3"; 

    useEffect(() => {
        // Auto-play attempt on mount
        const audio = audioRef.current;
        if (audio) {
            audio.volume = 0.3; // Gentle volume
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlaying(true);
                }).catch(error => {
                    // Auto-play was prevented
                    console.log("Autoplay prevented:", error);
                    setIsPlaying(false);
                });
            }
        }
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="fixed top-20 right-4 z-50">
            <audio ref={audioRef} src={AUDIO_URL} loop />
            
            <button 
                onClick={togglePlay}
                className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-md transition-all duration-300 ${
                    isPlaying 
                    ? 'bg-red-500/80 text-white hover:bg-red-600' 
                    : 'bg-white/80 text-slate-600 hover:bg-white'
                }`}
            >
                {isPlaying ? (
                    <>
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        <span className="text-xs font-medium hidden md:inline">Playing</span>
                    </>
                ) : (
                    <>
                        <VolumeX className="w-4 h-4" />
                        <span className="text-xs font-medium hidden md:inline">Music Off</span>
                    </>
                )}
            </button>
        </div>
    );
};
