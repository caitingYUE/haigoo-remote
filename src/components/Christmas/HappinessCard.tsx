import React, { useState, useEffect } from 'react';
import { Gift, X } from 'lucide-react';
import cardsData from '../../data/happiness-cards.json';

interface HappinessCardProps {
    onClose: () => void;
}

export const HappinessCard: React.FC<HappinessCardProps> = ({ onClose }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [card, setCard] = useState<{ id: number, quote: string, author: string } | null>(null);

    useEffect(() => {
        // Pick a random card
        const randomCard = cardsData[Math.floor(Math.random() * cardsData.length)];
        setCard(randomCard);

        // Save to local storage to limit 1 per day
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`haigoo_xmas_card_${today}`, 'true');
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
    };

    if (!card) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">

            {/* Container with flip effect or scale effect */}
            <div className="relative w-full max-w-sm aspect-[3/4] perspective-1000">

                {!isOpen ? (
                    // Closed Envelope State
                    <div
                        onClick={handleOpen}
                        className="w-full h-full bg-gradient-to-br from-red-600 to-red-700 rounded-xl shadow-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform duration-300 border-4 border-yellow-400/30 group"
                    >
                        <Gift className="w-20 h-20 text-yellow-200 animate-bounce mb-4" />
                        <p className="text-yellow-100 font-bold text-xl tracking-wider">点击拆开你的新年祝福</p>
                        <p className="text-yellow-200/60 text-sm mt-2">Haigoo 治愈卡片</p>

                        <div className="absolute inset-0 border-[8px] border-dashed border-white/20 rounded-xl pointer-events-none"></div>
                    </div>
                ) : (
                    // Opened Card State
                    <div className="relative w-full h-full bg-[#fffcf5] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in duration-500 rotate-1 border-8 border-white">
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 p-1 bg-white/50 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        {/* Content */}
                        <div className="absolute inset-0 p-8 flex flex-col justify-between bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">

                            {/* Header */}
                            <div className="text-center border-b-2 border-red-100 pb-4">
                                <span className="text-red-800 font-serif text-3xl font-bold tracking-widest block mb-1">新年快乐</span>
                                <span className="text-red-400 text-xs tracking-[0.3em] uppercase">Happy New Year</span>
                            </div>

                            {/* Quote */}
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-slate-700 text-xl md:text-2xl leading-relaxed font-serif text-center italic">
                                    "{card.quote}"
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="text-center pt-6 border-t-2 border-red-100">
                                <div className="w-12 h-12 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-2">
                                    <span className="text-2xl">🎄</span>
                                </div>
                                <p className="text-slate-500 font-medium text-sm">———— {card.author}</p>
                            </div>

                            {/* Decor */}
                            <div className="absolute -top-10 -left-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
                            <div className="absolute top-1/2 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
